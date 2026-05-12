import "server-only";

import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";

type TravelPlaceRow = {
  canonical_location: string;
  place_photo_name: string | null;
  place_photo_ref: string | null;
};

type PlacePhotoCacheRecord = {
  photoName: string | null;
  photoRef: string | null;
};

const SEARCH_FIELD_MASK = "places.photos,places.id";
const PHOTO_PROXY_HEIGHT = 220;

function buildPhotoUrl(entry: PlacePhotoCacheRecord): string {
  if (entry.photoName) {
    return `/api/place-photo?name=${encodeURIComponent(entry.photoName)}&maxH=${PHOTO_PROXY_HEIGHT}`;
  }
  if (entry.photoRef) {
    return `/api/place-photo?ref=${encodeURIComponent(entry.photoRef)}&maxH=${PHOTO_PROXY_HEIGHT}`;
  }
  return "";
}

async function fetchPlacePhotoFromGoogle(location: string): Promise<PlacePhotoCacheRecord> {
  const key = getGooglePlacesServerKey();
  if (!key) return { photoName: null, photoRef: null };

  try {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `${location} tourism`,
        pageSize: 1,
        languageCode: "en",
      }),
      cache: "no-store",
    });

    if (!response.ok) return { photoName: null, photoRef: null };
    const data = (await response.json().catch(() => null)) as
      | {
          places?: Array<{
            photos?: Array<{ name?: string }>;
          }>;
        }
      | null;

    const photoName = data?.places?.[0]?.photos?.[0]?.name;
    if (typeof photoName === "string" && photoName.startsWith("places/")) {
      return { photoName, photoRef: null };
    }
    return { photoName: null, photoRef: null };
  } catch {
    return { photoName: null, photoRef: null };
  }
}

/**
 * Ensures destination photos exist in DB cache for given canonical locations.
 * Returns a map of canonical location -> proxied image URL.
 */
export async function getOrCacheTravelPlacePhotoUrls(
  supabase: any,
  locations: string[],
): Promise<Map<string, string>> {
  const uniqueLocations = Array.from(
    new Set(locations.map((v) => v.trim()).filter((v) => v.length > 0)),
  );
  const out = new Map<string, string>();
  if (uniqueLocations.length === 0) return out;

  const { data } = await supabase
    .from("travel_places")
    .select("canonical_location, place_photo_name, place_photo_ref")
    .in("canonical_location", uniqueLocations);
  const rows = data ?? [];

  for (const row of rows) {
    const location = row.canonical_location?.trim();
    if (!location) continue;
    const currentEntry: PlacePhotoCacheRecord = {
      photoName: row.place_photo_name,
      photoRef: row.place_photo_ref,
    };

    if (currentEntry.photoName || currentEntry.photoRef) {
      const currentUrl = buildPhotoUrl(currentEntry);
      if (currentUrl) out.set(location, currentUrl);
      continue;
    }

    const fetched = await fetchPlacePhotoFromGoogle(location);
    if (!fetched.photoName && !fetched.photoRef) continue;

    await supabase
      .from("travel_places")
      .update({
        place_photo_name: fetched.photoName,
        place_photo_ref: fetched.photoRef,
        place_photo_cached_at: new Date().toISOString(),
      })
      .eq("canonical_location", location);

    const fetchedUrl = buildPhotoUrl(fetched);
    if (fetchedUrl) out.set(location, fetchedUrl);
  }

  return out;
}

