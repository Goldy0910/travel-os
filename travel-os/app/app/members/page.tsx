import HubMemberItem from "@/app/app/_components/hub-member-item";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";

type TripRow = { id: string; title: string | null; location: string | null };
type MemberRow = {
  user_id: string | null;
  email: string | null;
  name: string | null;
  trip_id: string | null;
};

export default async function MembersHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

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

  const { data: memberRowsData } =
    tripIds.length > 0
      ? await supabase
          .from("members")
          .select("user_id, email, name, trip_id")
          .in("trip_id", tripIds)
          .order("created_at", { ascending: true })
      : { data: [] as MemberRow[] };
  const memberRows = (memberRowsData ?? []) as MemberRow[];

  const profileIds = Array.from(
    new Set(memberRows.map((m) => (m.user_id ? String(m.user_id) : "")).filter(Boolean)),
  );
  const { data: profileRows } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", profileIds)
      : { data: [] as Array<{ id: string; name: string | null }> };
  const profileNameById = new Map<string, string>();
  for (const row of profileRows ?? []) {
    const n = typeof row.name === "string" ? row.name.trim() : "";
    if (n) profileNameById.set(String(row.id), n);
  }

  const byMember = new Map<string, { name: string; trips: Set<string> }>();
  for (const row of memberRows) {
    const key = row.user_id ? String(row.user_id) : (row.email ?? "").trim().toLowerCase();
    if (!key) continue;
    const tripLabel = tripLabelById.get(String(row.trip_id ?? "")) ?? "Trip";
    const displayName =
      (row.user_id ? profileNameById.get(String(row.user_id)) : "") ||
      (typeof row.name === "string" && row.name.trim()) ||
      (typeof row.email === "string" && row.email.includes("@") ? row.email.split("@")[0] : "") ||
      "Member";
    const cur = byMember.get(key) ?? { name: displayName, trips: new Set<string>() };
    cur.trips.add(tripLabel);
    byMember.set(key, cur);
  }

  const members = Array.from(byMember.values())
    .map((m) => ({ name: m.name, trips: Array.from(m.trips).sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-4 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)]">
      <div className="mx-auto w-full max-w-md space-y-3">
        <header>
          <h1 className="text-xl font-semibold text-slate-900">Members</h1>
          <p className="mt-0.5 text-xs text-slate-600">People across all your trips.</p>
        </header>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error.message}</p>
        ) : members.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <p>No members found yet.</p>
            <div className="mt-2.5 flex gap-2">
              <Link
                href="/app/create-trip"
                prefetch={false}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white"
              >
                Create trip
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
              </Link>
              <Link
                href="/app/home"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
              >
                Go home
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
              </Link>
            </div>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {members.map((member) => (
              <li key={`${member.name}-${member.trips.join("|")}`} className="border-b border-slate-100 last:border-0">
                <HubMemberItem name={member.name} trips={member.trips} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
