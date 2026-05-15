/** True when PostgREST/Supabase cannot see a table (migration not applied yet). */
export function isMissingTableError(
  error: { message?: string; code?: string } | null | undefined,
  tableName: string,
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const table = tableName.toLowerCase();
  if (!msg.includes(table)) return false;
  return (
    error.code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

export function isMissingTripMasterFilesTable(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  return isMissingTableError(error, "trip_master_files");
}

/** itinerary_items optional hydration columns not migrated yet */
export function isMissingItineraryMetadataColumn(
  error: { message?: string; code?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("google_place_id") ||
    msg.includes("notes") ||
    (msg.includes("category") && msg.includes("itinerary_items"))
  );
}
