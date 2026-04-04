import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import TripDocsClient, { type DocumentDTO } from "./_components/trip-docs-client";

type DocsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type DocumentRecord = {
  id: string | number;
  file_name: string | null;
  file_url: string | null;
  created_at?: string | null;
};

export default async function TripDocsPage({ params, searchParams }: DocsPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const successParam = query.success;
  const errorParam = query.error;
  const success =
    typeof successParam === "string" && successParam.length > 0
      ? decodeURIComponent(successParam)
      : "";
  const docsError =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) {
    redirect("/app/home");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) {
    redirect("/app/home");
  }

  const { data: documentsData } = await supabase
    .from("documents")
    .select("id, file_name, file_url, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });

  const documents: DocumentDTO[] = (documentsData ?? []).map((row: DocumentRecord) => ({
    id: String(row.id),
    file_name: row.file_name,
    file_url: row.file_url,
    created_at: row.created_at ?? null,
  }));

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-5">
        <TripDocsClient
          tripId={tripId}
          documents={documents}
          initialSuccess={success}
          initialError={docsError}
        />
      </div>
    </main>
  );
}
