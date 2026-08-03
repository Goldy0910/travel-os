"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

type PlaceActionsProps = {
  placeId: string;
  placeName: string;
  mapsUrl: string;
  lat: number | null;
  lng: number | null;
};

export default function PlaceActions({
  placeId,
  placeName,
  mapsUrl,
  lat,
  lng,
}: PlaceActionsProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

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

  async function save() {
    try {
      const key = "travel-os-saved-places";
      const raw = localStorage.getItem(key);
      const list: Array<{ placeId: string; name: string; savedAt: string }> = raw
        ? (JSON.parse(raw) as typeof list)
        : [];
      if (!list.some((p) => p.placeId === placeId)) {
        list.unshift({ placeId, name: placeName, savedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
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
      <button
        type="button"
        onClick={() => void save()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800"
      >
        {saved ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
