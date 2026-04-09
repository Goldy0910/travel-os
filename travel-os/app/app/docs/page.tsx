import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import Link from "next/link";
import { redirect } from "next/navigation";
import DocsHubClient, { type DocsHubItem } from "./docs-hub-client";

type TripRow = {
  id: string;
  title: string | null;
  location: string | null;
};
const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

function fileTypeLabel(fileName: string, fileUrl?: string | null) {
  const lower = fileName.toLowerCase();
  const lowerUrl = (fileUrl ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lowerUrl.includes(".pdf")) return "PDF";
  if (/\.(png|jpg|jpeg|gif|webp|heic)$/i.test(lower)) return "Image";
  if (/\.(png|jpg|jpeg|gif|webp|heic)(\?|$)/i.test(lowerUrl)) return "Image";
  return "File";
}

function extractStoragePath(rawUrl: string, bucket: string): string | null {
  const value = rawUrl.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }
  try {
    const u = new URL(value);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/object/public/${bucket}/`,
      `/object/sign/${bucket}/`,
    ];
    for (const marker of markers) {
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(u.pathname.slice(idx + marker.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

export default async function DocsHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  let user = authUser;
  // Sometimes server `getUser()` can briefly return null during token-refresh races
  // on client navigation; fall back to session user to avoid false sign-out redirects.
  if (!user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }

  if (!user) {
    redirect("/app/login");
  }

  const { trips: tripsRaw, tripIds, error } = await fetchTripsViaMembership(supabase, user.id, {
    tripColumns: "id, title, location",
  });
  const trips = (tripsRaw ?? []) as TripRow[];
  const tripLabelById = new Map<string, string>();
  for (const trip of trips) {
    tripLabelById.set(
      trip.id,
      (trip.title && trip.title.trim()) || (trip.location && trip.location.trim()) || "Trip",
    );
  }

  const { data: docsRows } =
    tripIds.length > 0
      ? await supabase
          .from("documents")
          .select("id, trip_id, user_id, file_name, file_url, created_at")
          .in("trip_id", tripIds)
          .order("created_at", { ascending: false })
      : { data: [] as Array<Record<string, string | null>> };

  const memberUserIds = Array.from(
    new Set(
      (docsRows ?? [])
        .map((d) => (d.user_id ? String(d.user_id) : ""))
        .filter((v) => v.length > 0),
    ),
  );
  const { data: profilesRows } =
    memberUserIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", memberUserIds)
      : { data: [] as Array<{ id: string; name: string | null }> };
  const profileNameById = new Map<string, string>();
  for (const p of profilesRows ?? []) {
    const n = typeof p.name === "string" ? p.name.trim() : "";
    if (n) profileNameById.set(String(p.id), n);
  }

  const items: DocsHubItem[] = await Promise.all((docsRows ?? []).map(async (row) => {
    const id = String(row.id ?? "");
    const tripId = String(row.trip_id ?? "");
    const fileName = String(row.file_name ?? "Untitled file");
    const uploadedById = row.user_id ? String(row.user_id) : "";
    const uploadedBy = profileNameById.get(uploadedById) ?? "Member";
    const createdAtRaw = row.created_at ? String(row.created_at) : null;
    const uploadedAt = createdAtRaw
      ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", year: "numeric" }).format(
          new Date(createdAtRaw),
        )
      : "Unknown date";

    const fileUrlRaw = row.file_url ? String(row.file_url) : null;
    const typeLabel = fileTypeLabel(fileName, fileUrlRaw);
    const storagePath = fileUrlRaw ? extractStoragePath(fileUrlRaw, DOCS_BUCKET) : null;
    let previewUrl = fileUrlRaw;
    if (storagePath) {
      const signed = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(storagePath, 60 * 60);
      if (signed.data?.signedUrl) previewUrl = signed.data.signedUrl;
    }

    return {
      id,
      fileName,
      fileTypeLabel: typeLabel,
      fileUrl: previewUrl,
      tripId,
      tripLabel: tripLabelById.get(tripId) ?? "Trip",
      uploadedBy,
      uploadedAt,
      createdAt: createdAtRaw,
      href: tripId ? `/app/trip/${tripId}?tab=docs` : "/app/docs",
    };
  }));

  return (
    <main className="w-full overflow-x-hidden bg-slate-50 px-4 py-6 pb-[calc(var(--travel-os-bottom-nav-h)+6rem)]">
      <div className="mx-auto w-full min-w-0 max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-600">
            All uploaded files across your trips.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.message}
          </p>
        ) : tripIds.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <p>No trips yet. Create a trip to start uploading docs.</p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/app/create-trip"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white"
              >
                Create trip
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
              </Link>
              <Link
                href="/app/home"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700"
              >
                Go home
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
              </Link>
            </div>
          </div>
        ) : (
          <DocsHubClient
            items={items}
            trips={trips.map((trip) => ({
              id: trip.id,
              label:
                (trip.title && trip.title.trim()) ||
                (trip.location && trip.location.trim()) ||
                "Trip",
            }))}
          />
        )}
      </div>
    </main>
  );
}
