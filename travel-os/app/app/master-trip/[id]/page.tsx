import { SetAppHeader } from "@/components/AppHeader";
import { parseMasterTripFile } from "@/lib/master-trip-file";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import MasterTripClient from "./master-trip-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MasterTripPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/app/login?next=/app/master-trip/${encodeURIComponent(id)}`);
  }

  const { data: row, error } = await supabase
    .from("trip_master_files")
    .select("id, trip_id, version, data, updated_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) {
    redirect("/app/trips");
  }

  const file = parseMasterTripFile(row.data);
  if (!file) {
    redirect("/app/trips");
  }

  if (row.trip_id) {
    redirect(
      `/app/trip/${encodeURIComponent(String(row.trip_id))}?tab=itinerary`,
    );
  }

  return (
    <>
      <SetAppHeader title="Your trip plan" showBack />
      <MasterTripClient
        masterId={String(row.id)}
        tripId={row.trip_id ? String(row.trip_id) : null}
        version={Number(row.version) || 1}
        file={file}
        updatedAt={String(row.updated_at)}
      />
    </>
  );
}
