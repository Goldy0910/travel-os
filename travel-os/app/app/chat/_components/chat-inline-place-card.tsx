"use client";

import type { ChatPlaceCard } from "@/lib/places/types";
import { Heart, MapPin, Plus, Star } from "lucide-react";

type ChatInlinePlaceCardProps = {
  card: ChatPlaceCard;
  onOpen: (card: ChatPlaceCard) => void;
  onFocusOnMap?: (card: ChatPlaceCard) => void;
};

/**
 * Place preview card for the horizontal strip under an assistant reply:
 * details left, photo right; fixed width so the row can scroll.
 */
export default function ChatInlinePlaceCard({
  card,
  onOpen,
  onFocusOnMap,
}: ChatInlinePlaceCardProps) {
  return (
    <article
      className="h-[8.5rem] w-[min(85vw,19.5rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:shadow-md"
      aria-label={`${card.name}${card.category ? `, ${card.category}` : ""}`}
    >
      <button
        type="button"
        onClick={() => {
          onFocusOnMap?.(card);
          onOpen(card);
        }}
        className="flex h-full w-full text-left"
      >
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  aria-hidden
                >
                  <MapPin className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold tracking-tight text-slate-900">
                    {card.name}
                  </h3>
                  {card.category ? (
                    <p className="truncate text-[0.65rem] text-slate-500">{card.category}</p>
                  ) : null}
                </div>
              </div>
            </div>
            {card.rating != null ? (
              <p className="inline-flex shrink-0 items-center gap-0.5 pt-0.5 text-[0.7rem] font-semibold text-slate-700">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                {card.rating.toFixed(1)}
              </p>
            ) : null}
          </div>

          {card.summary ? (
            <p className="line-clamp-3 pl-8 text-[0.75rem] leading-relaxed text-slate-600">
              {card.summary}
            </p>
          ) : card.address ? (
            <p className="line-clamp-2 pl-8 text-[0.75rem] leading-relaxed text-slate-600">
              {card.address}
            </p>
          ) : (
            <p className="pl-8 text-[0.75rem] text-slate-500">Tap for details</p>
          )}
        </div>

        <div className="relative w-[6.75rem] shrink-0 self-stretch bg-slate-100">
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied Google Places photo
            <img
              src={card.photoUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full min-h-[7.5rem] items-center justify-center">
              <MapPin className="h-6 w-6 text-slate-300" aria-hidden />
            </div>
          )}
          <div className="absolute right-1.5 top-1.5 flex gap-1">
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/80"
              aria-hidden
            >
              <Heart className="h-3 w-3" />
            </span>
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow-sm ring-1 ring-slate-200/80"
              aria-hidden
            >
              <Plus className="h-3 w-3" />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

export function ChatInlinePlaceCardSkeleton() {
  return (
    <div
      className="flex h-[8.5rem] w-[min(85vw,19.5rem)] shrink-0 animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"
      aria-hidden
    >
      <div className="flex-1 space-y-2 p-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-slate-200" />
          <div className="h-3.5 w-1/2 rounded bg-slate-200" />
        </div>
        <div className="ml-8 h-2.5 w-full rounded bg-slate-100" />
        <div className="ml-8 h-2.5 w-4/5 rounded bg-slate-100" />
      </div>
      <div className="w-[6.75rem] bg-slate-200" />
    </div>
  );
}
