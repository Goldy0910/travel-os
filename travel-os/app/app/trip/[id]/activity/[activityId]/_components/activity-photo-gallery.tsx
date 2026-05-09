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
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activePhoto) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhoto(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [activePhoto]);

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
            <button
              key={`${photoName}-${idx}`}
              type="button"
              className="h-28 w-full overflow-hidden rounded-2xl"
              onClick={() => setActivePhoto(photoName)}
              aria-label={`Open ${activityTitle} photo ${idx + 1} fullscreen`}
            >
              <img
                src={`/api/place-photo?name=${encodeURIComponent(photoName)}&maxH=420`}
                alt={`${activityTitle} photo ${idx + 1}`}
                className="h-full w-full object-cover"
                loading="eager"
                onLoad={bump}
                onError={bump}
              />
            </button>
          ))}
        </div>
      </div>
      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-4"
          onClick={() => setActivePhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${activityTitle} photo fullscreen view`}
        >
          <button
            type="button"
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow"
            onClick={() => setActivePhoto(null)}
            aria-label="Cancel and return to place details"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path
                d="M6 6L18 18M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <img
            src={`/api/place-photo?name=${encodeURIComponent(activePhoto)}&maxH=1600`}
            alt={`${activityTitle} fullscreen photo`}
            className="h-auto max-h-[88dvh] w-auto max-w-[96vw] rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}
