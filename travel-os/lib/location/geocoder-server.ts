import type { ReverseGeocodeResult } from "@/lib/location/types";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  state_district?: string;
  country?: string;
};

type NominatimReverse = {
  display_name?: string;
  address?: NominatimAddress;
  lat?: string;
  lon?: string;
};

function pickCity(address: NominatimAddress | undefined, displayName?: string | null): string | null {
  if (address) {
    const fromAddress =
      address.city?.trim() ||
      address.town?.trim() ||
      address.village?.trim() ||
      address.municipality?.trim() ||
      address.county?.trim() ||
      null;
    if (fromAddress) return fromAddress;
  }
  // Fallback: first segment of display name (e.g. "Hyderabad, Telangana, India")
  const first = displayName?.split(",")[0]?.trim();
  return first || null;
}

function pickState(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  return (
    address.state?.trim() ||
    address.region?.trim() ||
    address.state_district?.trim() ||
    null
  );
}

/**
 * Server-side reverse geocode via OpenStreetMap Nominatim.
 * No Google Geocoding billing; rate-limit callers (chat/settings only).
 */
export async function reverseGeocodeServer(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      // Nominatim usage policy requires a valid identifying User-Agent.
      "User-Agent": "TravelTill99/1.0 (travel planning app; location personalization)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Reverse geocode failed (${res.status})`);
  }

  const data = (await res.json()) as NominatimReverse;
  return {
    city: pickCity(data.address, data.display_name),
    state: pickState(data.address),
    country: data.address?.country?.trim() || null,
    displayName: data.display_name?.trim() || null,
  };
}

export async function forwardGeocodeServer(
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

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
      "User-Agent": "TravelTill99/1.0 (travel planning app; location personalization)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Forward geocode failed (${res.status})`);
  }

  const rows = (await res.json()) as Array<
    NominatimReverse & { address?: NominatimAddress }
  >;
  const hit = rows[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    latitude: lat,
    longitude: lng,
    city: pickCity(hit.address, hit.display_name),
    state: pickState(hit.address),
    country: hit.address?.country?.trim() || null,
  };
}
