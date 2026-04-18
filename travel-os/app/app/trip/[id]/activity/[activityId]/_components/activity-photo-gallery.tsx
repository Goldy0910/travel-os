"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useEffect, useState } from "react";

type Props = {
  photos: string[];
  activityTitle: string;
};

export default function ActivityPhotoGallery({ photos, activityTitle }: Props) {
  const [resolved, setResolved] = useState(0);
  const [showLoader, setShowLoader] = useState(photos.length > 0);

  useEffect(() => {
    setResolved(0);
    setShowLoader(photos.length > 0);
  }, [photos]);

  useEffect(() => {
    if (photos.length === 0) return;
    if (resolved >= photos.length) setShowLoader(false);
  }, [resolved, photos.length]);

  useEffect(() => {
    if (photos.length === 0) return;
    const id = window.setTimeout(() => setShowLoader(false), 18_000);
    return () => window.clearTimeout(id);
  }, [photos]);

  const bump = () => setResolved((n) => n + 1);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Photos</h2>
      <div className="relative mt-3 min-h-[7rem]">
        {showLoader ? (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/90 backdrop-blur-[1px]"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <ButtonSpinner className="h-9 w-9 text-indigo-600" />
            <p className="text-sm font-medium text-slate-600">Loading photos…</p>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((photoName, idx) => (
            <img
              key={`${photoName}-${idx}`}
              src={`/api/place-photo?name=${encodeURIComponent(photoName)}&maxH=420`}
              alt={`${activityTitle} photo ${idx + 1}`}
              className="h-28 w-full rounded-2xl object-cover"
              loading="eager"
              onLoad={bump}
              onError={bump}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
