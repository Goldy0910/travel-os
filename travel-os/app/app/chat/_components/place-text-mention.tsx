"use client";

import type { ChatPlaceCard } from "@/lib/places/types";
import { MapPin, Star } from "lucide-react";
import { useId, useState } from "react";

type PlaceTextMentionProps = {
  card: ChatPlaceCard;
  children: React.ReactNode;
  onOpen: (card: ChatPlaceCard) => void;
  onHover?: (card: ChatPlaceCard) => void;
  onHoverEnd?: () => void;
};

function previewSnippet(card: ChatPlaceCard): string {
  const text = (card.summary || card.address || "").trim();
  if (!text) {
    if (card.rating != null) return `Rated ${card.rating.toFixed(1)} — click for full details.`;
    return "Click for photos, hours, and reviews.";
  }
  return text.length > 120 ? `${text.slice(0, 117).trimEnd()}…` : text;
}

/**
 * Clickable place name inside assistant prose.
 * Hover → inline preview + map pin highlight (via callbacks).
 * Click → full details drawer.
 */
export default function PlaceTextMention({
  card,
  children,
  onOpen,
  onHover,
  onHoverEnd,
}: PlaceTextMentionProps) {
  const previewId = useId();
  const [showPreview, setShowPreview] = useState(false);

  const openPreview = () => {
    setShowPreview(true);
    onHover?.(card);
  };

  const closePreview = () => {
    setShowPreview(false);
    onHoverEnd?.();
  };

  return (
    <span className="relative inline">
      <button
        type="button"
        className="rounded-sm font-semibold text-sky-800 underline decoration-sky-300/80 decoration-from-font underline-offset-2 transition hover:bg-sky-50 hover:text-sky-950 hover:decoration-sky-600"
        aria-describedby={showPreview ? previewId : undefined}
        onMouseEnter={openPreview}
        onMouseLeave={closePreview}
        onFocus={openPreview}
        onBlur={closePreview}
        onClick={(e) => {
          e.preventDefault();
          closePreview();
          onOpen(card);
        }}
      >
        {children}
      </button>

      {showPreview ? (
        <span
          id={previewId}
          role="tooltip"
          className="pointer-events-none absolute left-0 top-[calc(100%+0.35rem)] z-40 w-[min(16.5rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl ring-1 ring-slate-900/5"
        >
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied Google Places photo
            <img src={card.photoUrl} alt="" className="h-24 w-full object-cover" />
          ) : (
            <span className="flex h-14 items-center justify-center bg-slate-100">
              <MapPin className="h-5 w-5 text-slate-300" aria-hidden />
            </span>
          )}
          <span className="block space-y-1 p-2.5">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">
                  {card.name}
                </span>
                {card.category ? (
                  <span className="block truncate text-[0.7rem] text-slate-500">
                    {card.category}
                  </span>
                ) : null}
              </span>
              {card.rating != null ? (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-slate-800">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                  {card.rating.toFixed(1)}
                </span>
              ) : null}
            </span>
            <span className="block text-[0.75rem] leading-5 text-slate-600">
              {previewSnippet(card)}
            </span>
            <span className="block text-[0.65rem] font-medium text-slate-400">
              Click for full details
            </span>
          </span>
        </span>
      ) : null}
    </span>
  );
}
