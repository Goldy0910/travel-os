import { forwardGeocodeServer } from "@/lib/location/geocoder-server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/location/forward-geocode
 * Body: { query: string } — manual city / place override.
 */
export async function POST(req: NextRequest) {
  let body: { query?: unknown };
  try {
    body = (await req.json()) as { query?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length > 200) {
    return NextResponse.json({ ok: false, error: "Enter a city or place name" }, { status: 400 });
  }

  try {
    const result = await forwardGeocodeServer(query, req.signal);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Forward geocode failed",
      },
      { status: 502 },
    );
  }
}
