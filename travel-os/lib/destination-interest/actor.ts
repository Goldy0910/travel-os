import { cookies } from "next/headers";
import {
  ACTOR_ID_MAX_LEN,
  GUEST_ACTOR_COOKIE,
  GUEST_ACTOR_PREFIX,
} from "@/lib/destination-interest/constants";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isValidInterestActorId(value: string): boolean {
  const id = value.trim();
  if (!id || id.length > ACTOR_ID_MAX_LEN) return false;
  if (isUuid(id)) return true;
  if (id.startsWith(GUEST_ACTOR_PREFIX) && isUuid(id.slice(GUEST_ACTOR_PREFIX.length))) {
    return true;
  }
  return false;
}

/**
 * Authenticated users → auth user id.
 * Guests → stable httpOnly session cookie (not a browser fingerprint).
 */
export async function resolveInterestActorId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) return user.id;

    const jar = await cookies();
    const existing = jar.get(GUEST_ACTOR_COOKIE)?.value?.trim() ?? "";
    if (isValidInterestActorId(existing)) return existing;

    const guestId = `${GUEST_ACTOR_PREFIX}${crypto.randomUUID()}`;
    try {
      jar.set(GUEST_ACTOR_COOKIE, guestId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 400,
        secure: process.env.NODE_ENV === "production",
      });
    } catch {
      // Cookie may be read-only in some server contexts; still return the id for this request.
    }
    return guestId;
  } catch {
    return null;
  }
}
