import { NextRequest, NextResponse } from "next/server";

import { isPlacesPhotoResourceName } from "@/lib/google-places-ids";
import { getGooglePlacesServerKey } from "@/lib/google-places-server-key";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = getGooglePlacesServerKey();
  if (!key) {
    return NextResponse.json(
      { error: "Missing Google Places server API key (GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY)." },
      { status: 503 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const name = sp.get("name");
  const ref = sp.get("ref");
  const maxHRaw = Number(sp.get("maxH"));
  // Places Photo (New) allows 1–4800px
  const maxH = Number.isFinite(maxHRaw) ? Math.min(4800, Math.max(64, Math.round(maxHRaw))) : 200;
  const maxW = Math.min(4800, Math.round(maxH * 2));

  if (name) {
    const photoName = name.trim();
    if (photoName.length > 512 || !isPlacesPhotoResourceName(photoName)) {
      return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
    }

    // Prefer JSON+photoUri so we do not forward API-key headers onto the CDN redirect target
    // (a common cause of blank / broken place photos).
    const mediaMetaUrl =
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxHeightPx=${maxH}&maxWidthPx=${maxW}&skipHttpRedirect=true&key=${encodeURIComponent(key)}`;

    const metaRes = await fetch(mediaMetaUrl, {
      headers: { "X-Goog-Api-Key": key },
      cache: "no-store",
      redirect: "manual",
    });

    if (metaRes.ok) {
      const meta = (await metaRes.json().catch(() => null)) as { photoUri?: string } | null;
      const photoUri = typeof meta?.photoUri === "string" ? meta.photoUri.trim() : "";
      if (photoUri) {
        const imgRes = await fetch(photoUri, { cache: "force-cache", redirect: "follow" });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get("content-type") || "image/jpeg";
          const buf = await imgRes.arrayBuffer();
          return new NextResponse(buf, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=86400",
            },
          });
        }
      }
    }

    // Fallback: follow redirect from Places media endpoint without custom headers on the hop
    const mediaUrl =
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxHeightPx=${maxH}&maxWidthPx=${maxW}&key=${encodeURIComponent(key)}`;
    const upstream = await fetch(mediaUrl, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!upstream.ok) {
      const status = upstream.status === 403 || upstream.status === 401 ? 503 : upstream.status === 404 ? 404 : 502;
      return NextResponse.json(
        {
          error:
            status === 503
              ? "Places Photo API denied this key. Enable Places API (New) and allow it on GOOGLE_PLACES_API_KEY."
              : "Failed to load place photo",
        },
        { status },
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Places photo response was not an image" }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
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
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  return NextResponse.json({ error: "Provide name (Places New) or ref (legacy)" }, { status: 400 });
}
