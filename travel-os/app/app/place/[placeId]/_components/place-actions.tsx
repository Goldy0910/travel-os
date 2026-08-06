"use client";

import SavePlaceButton from "@/components/save-place-button";
import { Share2 } from "lucide-react";
import { useState } from "react";

type PlaceActionsProps = {
  placeId: string;
  placeName: string;
  mapsUrl: string;
  lat: number | null;
  lng: number | null;
  destinationId?: string | null;
  address?: string;
  category?: string;
  photoName?: string | null;
  photoUrl?: string;
  rating?: number | null;
};

export default function PlaceActions({
  placeId,
  placeName,
  mapsUrl,
  lat,
  lng,
  destinationId = null,
  address = "",
  category = "",
  photoName = null,
  photoUrl = "",
  rating = null,
}: PlaceActionsProps) {
  const [copied, setCopied] = useState(false);

  const detailsPath =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/place/${encodeURIComponent(placeId)}`
      : `/app/place/${encodeURIComponent(placeId)}`;

  const directionsUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : mapsUrl;

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: placeName, url: detailsPath, text: placeName });
        return;
      }
      await navigator.clipboard.writeText(detailsPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // user cancelled share
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {directionsUrl ? (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          Directions
        </a>
      ) : null}
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
      >
        <Share2 className="h-4 w-4" aria-hidden />
        {copied ? "Link copied" : "Share"}
      </button>
      <SavePlaceButton
        place={{
          placeId,
          name: placeName,
          address,
          category,
          photoName,
          photoUrl,
          rating,
          mapsUrl,
          lat,
          lng,
          destinationId,
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
      />
    </div>
  );
}
