"use client";

import { useState } from "react";

type PlaceGalleryProps = {
  photos: string[];
  placeName: string;
};

export default function PlaceGallery({ photos, placeName }: PlaceGalleryProps) {
  const [active, setActive] = useState(0);
  if (!photos.length) return null;

  const safeIndex = Math.min(active, photos.length - 1);
  const activeName = photos[safeIndex] ?? photos[0];

  return (
    <section className="space-y-3" aria-label={`${placeName} photo gallery`}>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- proxied Google Places photo */}
        <img
          src={`/api/place-photo?name=${encodeURIComponent(activeName)}&maxH=900`}
          alt={`${placeName} photo ${safeIndex + 1} of ${photos.length}`}
          className="aspect-[16/10] w-full object-cover"
          loading="eager"
        />
      </div>
      {photos.length > 1 ? (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {photos.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={index === safeIndex}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 ${
                index === safeIndex ? "border-slate-900" : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/place-photo?name=${encodeURIComponent(name)}&maxH=160`}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
