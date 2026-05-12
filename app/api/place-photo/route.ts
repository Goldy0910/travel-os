import { NextRequest, NextResponse } from "next/server";

import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";

export const dynamic = "force-dynamic";

/** Places API (New) photo resource name: places/{place_id}/photos/{photo} */
const NEW_PHOTO_NAME_RE = /^places\/.+\/photos\/.+$/;

export async function GET(req: NextRequest) {
  const key = getGooglePlacesServerKey();
  if (!key) {
    return new NextResponse(null, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const name = sp.get("name");
  const ref = sp.get("ref");
  const maxHRaw = Number(sp.get("maxH"));
  const maxH = Number.isFinite(maxHRaw) ? Math.min(800, Math.max(64, Math.round(maxHRaw))) : 200;
  const maxW = Math.min(1600, Math.round(maxH * 2));

  if (name) {
    if (name.length > 512 || !NEW_PHOTO_NAME_RE.test(name)) {
      return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
    }

    const mediaUrl = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=${maxH}&maxWidthPx=${maxW}&key=${encodeURIComponent(key)}`;
    const upstream = await fetch(mediaUrl, {
      headers: { "X-Goog-Api-Key": key },
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (ref) {
    if (ref.length > 512 || ref.length < 8 || !/^[\w.-]+$/.test(ref)) {
      return NextResponse.json({ error: "Invalid photo reference" }, { status: 400 });
    }

    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxW}&photo_reference=${encodeURIComponent(ref)}&key=${encodeURIComponent(key)}`;
    const upstream = await fetch(photoUrl, { cache: "no-store", redirect: "follow" });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return NextResponse.json({ error: "Provide name (Places New) or ref (legacy)" }, { status: 400 });
}
