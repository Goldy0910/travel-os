export type SavedPlace = {
  id: string;
  placeId: string;
  name: string;
  address: string;
  category: string;
  photoName: string | null;
  photoUrl: string;
  rating: number | null;
  mapsUrl: string;
  lat: number | null;
  lng: number | null;
  destinationId: string | null;
  createdAt: string;
};

export type SavedPlaceInput = {
  placeId: string;
  name: string;
  address?: string | null;
  category?: string | null;
  photoName?: string | null;
  photoUrl?: string | null;
  rating?: number | null;
  mapsUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  destinationId?: string | null;
};

export type SavedPlaceRow = {
  id: string;
  user_id: string;
  place_id: string;
  name: string;
  address: string | null;
  category: string | null;
  photo_name: string | null;
  photo_url: string | null;
  rating: number | string | null;
  maps_url: string | null;
  lat: number | null;
  lng: number | null;
  destination_id: string | null;
  created_at: string;
};

export function rowToSavedPlace(row: SavedPlaceRow): SavedPlace {
  const rating =
    typeof row.rating === "number"
      ? row.rating
      : typeof row.rating === "string" && row.rating.trim()
        ? Number(row.rating)
        : null;
  return {
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    address: row.address ?? "",
    category: row.category ?? "",
    photoName: row.photo_name,
    photoUrl: row.photo_url ?? "",
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    mapsUrl: row.maps_url ?? "",
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    destinationId: row.destination_id,
    createdAt: row.created_at,
  };
}

export function isMissingSavedPlacesTable(error: { message?: string; code?: string } | null): boolean {
  if (!error?.message) return false;
  return /saved_places|schema cache|PGRST|does not exist|relation/i.test(error.message);
}
