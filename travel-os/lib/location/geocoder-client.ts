import type { ReverseGeocodeResult } from "@/lib/location/types";

/**
 * Client helper — calls our server reverse-geocode route (keeps keys / UA server-side).
 */
export async function reverseGeocodeClient(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const res = await fetch("/api/location/reverse-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
    signal,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    result?: ReverseGeocodeResult;
  };
  if (!res.ok || !data.ok || !data.result) {
    throw new Error(data.error || "Could not reverse-geocode location");
  }
  return data.result;
}

/**
 * Forward geocode a free-text place name into coords + labels (manual override).
 */
export async function forwardGeocodeClient(
  query: string,
  signal?: AbortSignal,
): Promise<{
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  country: string | null;
} | null> {
  const q = query.trim();
  if (!q) return null;
  const res = await fetch("/api/location/forward-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
    signal,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    result?: {
      latitude: number;
      longitude: number;
      city: string | null;
      state: string | null;
      country: string | null;
    } | null;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Could not find that place");
  }
  return data.result ?? null;
}
