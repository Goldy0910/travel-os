import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST: relation not in schema cache (e.g. migration not applied). */
const PGRST_MISSING_RELATION = "PGRST205";

export function isProfilesTableMissing(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  if (err.code === PGRST_MISSING_RELATION) return true;
  const m = err.message ?? "";
  return /could not find the table ['"]public\.profiles['"]/i.test(m) || /\bprofiles\b.*schema cache/i.test(m);
}

type ProfileRow = { name: string | null; avatar_url: string | null };

/**
 * Upsert `profiles` when the table exists; otherwise persist to Auth `user_metadata`
 * (`full_name`, `avatar_url`) so Settings still works before migrations are applied.
 */
export async function upsertProfileOrUserMetadata(
  supabase: SupabaseClient,
  userId: string,
  row: ProfileRow,
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      name: row.name,
      avatar_url: row.avatar_url,
    },
    { onConflict: "id" },
  );

  if (!error) return;
  if (!isProfilesTableMissing(error)) throw error;

  const data: Record<string, string> = {
    full_name: row.name?.trim() ?? "",
  };
  if (row.avatar_url?.trim()) {
    data.avatar_url = row.avatar_url.trim();
  }

  const { error: authErr } = await supabase.auth.updateUser({ data });
  if (authErr) throw authErr;
}
