"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId } from "react";

export type PlacePhotoLightboxProps = {
  open: boolean;
  images: string[];
  index: number;
  alt?: string;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

/**
 * Full-screen place photo viewer. Close returns to the previous view (drawer/page).
 */
export default function PlacePhotoLightbox({
  open,
  images,
  index,
  alt = "Place photo",
  onClose,
  onIndexChange,
}: PlacePhotoLightboxProps) {
  const titleId = useId();
  const safeIndex = images.length ? Math.min(Math.max(index, 0), images.length - 1) : 0;
  const src = images[safeIndex] ?? "";

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        onIndexChange?.((safeIndex + 1) % images.length);
      }
      if (event.key === "ArrowLeft" && images.length > 1) {
        onIndexChange?.((safeIndex - 1 + images.length) % images.length);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, onIndexChange, images.length, safeIndex]);

  if (!open || !src) return null;

  return (
    <div
      className="fixed inset-0 z-[640] flex flex-col bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 text-white">
        <p id={titleId} className="text-sm font-medium text-white/80">
          {images.length > 1 ? `${safeIndex + 1} / ${images.length}` : "Photo"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close full screen photo"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {/* eslint-disable-next-line @next/next/no-img-element -- proxied Google Places photo */}
        <img
          src={src}
          alt={alt}
          className="max-h-full max-w-full object-contain"
        />

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => onIndexChange?.((safeIndex - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onIndexChange?.((safeIndex + 1) % images.length)}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
