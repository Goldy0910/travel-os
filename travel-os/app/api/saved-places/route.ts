import {
  isMissingSavedPlacesTable,
  rowToSavedPlace,
  type SavedPlaceInput,
  type SavedPlaceRow,
} from "@/lib/saved-places/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, user_id, place_id, name, address, category, photo_name, photo_url, rating, maps_url, lat, lng, destination_id, created_at";

function parseInput(body: unknown): SavedPlaceInput | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const placeId = typeof row.placeId === "string" ? row.placeId.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!placeId || !name || placeId.length > 256 || name.length > 200) return null;
  const numOrNull = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const strOrNull = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    placeId,
    name,
    address: strOrNull(row.address),
    category: strOrNull(row.category),
    photoName: strOrNull(row.photoName),
    photoUrl: strOrNull(row.photoUrl),
    rating: numOrNull(row.rating),
    mapsUrl: strOrNull(row.mapsUrl),
    lat: numOrNull(row.lat),
    lng: numOrNull(row.lng),
    destinationId: strOrNull(row.destinationId),
  };
}

/** GET /api/saved-places — list all, or ?ids=a,b for saved-id set. */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const idsParam = req.nextUrl.searchParams.get("ids")?.trim() || "";
  if (idsParam) {
    const ids = [
      ...new Set(
        idsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 50),
      ),
    ];
    if (!ids.length) {
      return NextResponse.json({ ok: true, savedIds: [] as string[] });
    }
    const { data, error } = await supabase
      .from("saved_places")
      .select("place_id")
      .eq("user_id", user.id)
      .in("place_id", ids);
    if (error) {
      if (isMissingSavedPlacesTable(error)) {
        return NextResponse.json({ ok: true, savedIds: [], migrationPending: true });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      savedIds: (data ?? []).map((row) => String((row as { place_id: string }).place_id)),
    });
  }

  const { data, error } = await supabase
    .from("saved_places")
    .select(SELECT_COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingSavedPlacesTable(error)) {
      return NextResponse.json({ ok: true, items: [], migrationPending: true });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    items: ((data ?? []) as SavedPlaceRow[]).map(rowToSavedPlace),
  });
}

/** POST /api/saved-places — save (upsert) a place. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const input = parseInput(body);
  if (!input) {
    return NextResponse.json({ ok: false, error: "Invalid place payload" }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    place_id: input.placeId,
    name: input.name,
    address: input.address,
    category: input.category,
    photo_name: input.photoName,
    photo_url: input.photoUrl,
    rating: input.rating,
    maps_url: input.mapsUrl,
    lat: input.lat,
    lng: input.lng,
    destination_id: input.destinationId,
  };

  const { data, error } = await supabase
    .from("saved_places")
    .upsert(payload, { onConflict: "user_id,place_id" })
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    if (isMissingSavedPlacesTable(error)) {
      return NextResponse.json(
        { ok: false, error: "Apply saved_places migration", migrationPending: true },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    item: data ? rowToSavedPlace(data as SavedPlaceRow) : undefined,
  });
}
