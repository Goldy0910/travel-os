"use server";

import { randomBytes } from "crypto";
import { parseMasterTripFile } from "@/lib/master-trip-file";
import { getOrCacheTravelPlacePhotoUrls } from "@/lib/travel-place-photo-cache";
import {
  absolutizeShareImage,
  buildPublicTripShareSnapshot,
  tripShareUrl,
} from "@/lib/trip-share";
function shareError(error: string): { ok: false; error: string } {
  return { ok: false, error };
}
import { getResolvedPublicSiteUrl } from "@/lib/public-site-url";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

function newShareToken(): string {
  return randomBytes(18).toString("base64url");
}

async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
}

export type CreateTripShareResult =
  | { ok: true; token: string; shareUrl: string }
  | { ok: false; error: string };

export type RevokeTripShareResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createTripShareAction(
  masterId: string,
): Promise<CreateTripShareResult> {
  const ctx = await getAuthContext();
  if (!ctx) return shareError("Sign in to share your trip plan.");

  const { supabase, user } = ctx;
  const id = masterId.trim();
  if (!id) return shareError("Missing plan id.");

  const { data: row, error } = await supabase
    .from("trip_master_files")
    .select("id, data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !row) return shareError("Plan not found.");

  const file = parseMasterTripFile(row.data);
  if (!file) return shareError("Could not read this plan.");

  const location = file.destination.canonicalLocation.trim();
  const photoMap = await getOrCacheTravelPlacePhotoUrls(supabase, [location]);
  const heroRelative = photoMap.get(location);
  const baseUrl = await getResolvedPublicSiteUrl();
  const heroImageAbsolute = absolutizeShareImage(heroRelative, baseUrl);

  const snapshot = buildPublicTripShareSnapshot(file, {
    heroImageUrl: heroRelative,
    heroImageAbsolute,
    sharedAt: new Date().toISOString(),
  });

  const { data: existing } = await supabase
    .from("trip_public_shares")
    .select("id, token")
    .eq("master_trip_file_id", id)
    .is("revoked_at", null)
    .maybeSingle();

  let token: string;

  if (existing?.token) {
    token = String(existing.token);
    const { error: updateError } = await supabase
      .from("trip_public_shares")
      .update({
        snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (updateError) return shareError("Could not refresh share link.");
  } else {
    token = newShareToken();
    const { error: insertError } = await supabase.from("trip_public_shares").insert({
      token,
      master_trip_file_id: id,
      user_id: user.id,
      snapshot,
    });

    if (insertError) return shareError("Could not create share link.");
  }

  const shareUrl = tripShareUrl(token, baseUrl);
  revalidatePath(`/share/${token}`);
  revalidatePath(`/app/master-trip/${id}`);

  return { ok: true, token, shareUrl };
}

export async function revokeTripShareAction(masterId: string): Promise<RevokeTripShareResult> {
  const ctx = await getAuthContext();
  if (!ctx) return shareError("Sign in to manage sharing.");

  const { supabase, user } = ctx;
  const { error } = await supabase
    .from("trip_public_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("master_trip_file_id", masterId.trim())
    .eq("user_id", user.id)
    .is("revoked_at", null);

  if (error) return shareError("Could not revoke share link.");
  revalidatePath(`/app/master-trip/${masterId.trim()}`);
  return { ok: true };
}
