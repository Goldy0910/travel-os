import { isUserLocation, type UserLocation } from "@/lib/location/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ProfileLocationRow = {
  location_lat: number | null;
  location_lng: number | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  location_source: string | null;
  location_enabled: boolean | null;
  location_updated_at: string | null;
};

function rowToLocation(row: ProfileLocationRow): UserLocation | null {
  const lat = row.location_lat;
  const lng = row.location_lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const source =
    row.location_source === "manual" || row.location_source === "profile"
      ? row.location_source
      : "gps";
  return {
    latitude: lat,
    longitude: lng,
    city: row.location_city,
    state: row.location_state,
    country: row.location_country,
    lastUpdated: row.location_updated_at || new Date().toISOString(),
    source,
    enabled: row.location_enabled !== false,
  };
}

/**
 * GET /api/location/profile — load persisted location for the signed-in user.
 * PUT /api/location/profile — save or clear location on profiles.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "location_lat, location_lng, location_city, location_state, location_country, location_source, location_enabled, location_updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // Migration not applied yet — soft-fail so the app keeps working.
    if (/column|schema cache|PGRST/i.test(error.message)) {
      return NextResponse.json({ ok: true, location: null, migrationPending: true });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    location: data ? rowToLocation(data as ProfileLocationRow) : null,
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { location?: unknown };
  try {
    body = (await req.json()) as { location?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const location =
    body.location === null
      ? null
      : isUserLocation(body.location)
        ? body.location
        : null;

  if (body.location != null && location == null) {
    return NextResponse.json({ ok: false, error: "Invalid location payload" }, { status: 400 });
  }

  const payload = location
    ? {
        id: user.id,
        location_lat: location.latitude,
        location_lng: location.longitude,
        location_city: location.city,
        location_state: location.state,
        location_country: location.country,
        location_source: location.source,
        location_enabled: location.enabled,
        location_updated_at: location.lastUpdated,
        updated_at: new Date().toISOString(),
      }
    : {
        id: user.id,
        location_lat: null,
        location_lng: null,
        location_city: null,
        location_state: null,
        location_country: null,
        location_source: null,
        location_enabled: false,
        location_updated_at: null,
        updated_at: new Date().toISOString(),
      };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    if (/column|schema cache|PGRST/i.test(error.message)) {
      return NextResponse.json({
        ok: true,
        saved: false,
        migrationPending: true,
        warning: "Location columns are not migrated yet; saved locally only.",
      });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved: true, location });
}
