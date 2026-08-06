"use client";

import SavePlaceButton from "@/components/save-place-button";
import type { SavedPlace } from "@/lib/saved-places/types";
import { MapPin, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function photoSrc(place: { photoUrl: string; photoName: string | null }): string {
  if (place.photoUrl.startsWith("/api/place-photo")) return place.photoUrl;
  if (place.photoName?.startsWith("places/")) {
    return `/api/place-photo?name=${encodeURIComponent(place.photoName)}&maxH=480`;
  }
  return place.photoUrl;
}

export default function SavedPlacesList({ initialItems }: { initialItems: SavedPlace[] }) {
  const [items, setItems] = useState(initialItems);

  if (!items.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <p className="text-sm font-semibold text-slate-800">No saved places yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Tap the heart on a place card or in place details to save it here.
        </p>
        <Link
          href="/app/home"
          className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          Browse in Chat
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((place) => {
        const src = photoSrc(place);
        return (
          <li key={place.id}>
            <article className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Link
                href={`/app/place/${encodeURIComponent(place.placeId)}`}
                className="flex min-w-0 flex-1 text-left"
              >
                <div className="relative h-[7.5rem] w-28 shrink-0 bg-slate-100 sm:w-36">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <MapPin className="h-6 w-6 text-slate-300" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 p-3.5">
                  {place.category ? (
                    <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                      {place.category}
                    </p>
                  ) : null}
                  <h2 className="truncate text-base font-semibold text-slate-900">{place.name}</h2>
                  {place.address ? (
                    <p className="line-clamp-2 text-sm text-slate-600">{place.address}</p>
                  ) : null}
                  {place.rating != null ? (
                    <p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                      {place.rating.toFixed(1)}
                    </p>
                  ) : null}
                </div>
              </Link>
              <div className="flex items-start p-3">
                <SavePlaceButton
                  variant="icon"
                  initialSaved
                  place={{
                    placeId: place.placeId,
                    name: place.name,
                    address: place.address,
                    category: place.category,
                    photoName: place.photoName,
                    photoUrl: place.photoUrl,
                    rating: place.rating,
                    mapsUrl: place.mapsUrl,
                    lat: place.lat,
                    lng: place.lng,
                    destinationId: place.destinationId,
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500"
                  onSavedChange={(saved) => {
                    if (!saved) {
                      setItems((prev) => prev.filter((row) => row.placeId !== place.placeId));
                    }
                  }}
                />
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
