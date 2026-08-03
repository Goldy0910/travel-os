import { reverseGeocodeServer } from "@/lib/location/geocoder-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/location/reverse-geocode
 * Body: { latitude, longitude }
 */
export async function POST(req: NextRequest) {
  let body: { latitude?: unknown; longitude?: unknown };
  try {
    body = (await req.json()) as { latitude?: unknown; longitude?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const latitude = typeof body.latitude === "number" ? body.latitude : Number(body.latitude);
  const longitude =
    typeof body.longitude === "number" ? body.longitude : Number(body.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ ok: false, error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    const result = await reverseGeocodeServer(latitude, longitude, req.signal);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Reverse geocode failed",
      },
      { status: 502 },
    );
  }
}
