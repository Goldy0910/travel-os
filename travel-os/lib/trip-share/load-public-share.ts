import "server-only";

import { parseTripShareRpcResult } from "@/lib/trip-share/parse";
import type { PublicTripShareSnapshot } from "@/lib/trip-share/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function loadPublicTripShareByToken(
  token: string,
): Promise<PublicTripShareSnapshot | null> {
  const trimmed = token.trim();
  if (trimmed.length < 16) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_trip_share_by_token", {
    p_token: trimmed,
  });

  if (error || !data) return null;
  const parsed = parseTripShareRpcResult(data);
  if (!parsed.found) return null;
  return parsed.snapshot;
}
