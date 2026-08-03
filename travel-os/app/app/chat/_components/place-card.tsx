"use client";

import type { ChatPlaceCard } from "@/lib/places/types";
import { ExternalLink, MapPin, Star } from "lucide-react";
import Link from "next/link";

function Stars({ rating }: { rating: number | null }) {
  if (rating == null) {
    return <span className="text-[0.7rem] text-slate-400">No rating</span>;
  }
  const filled = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-[0.7rem] font-semibold text-slate-700">{rating.toFixed(1)}</span>
    </span>
  );
}

export function PlaceCardSkeleton() {
  return (
    <article
      className="w-[min(100%,16.5rem)] shrink-0 animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-hidden
    >
      <div className="h-36 bg-slate-200" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
        <div className="h-3 w-full rounded bg-slate-100" />
      </div>
    </article>
  );
}

export default function PlaceCard({ card }: { card: ChatPlaceCard }) {
  const detailsHref = `/app/place/${encodeURIComponent(card.placeId)}`;
  const openLabel =
    card.openNow == null ? null : card.openNow ? "Open now" : "Closed";

  return (
    <article
      className="w-[min(100%,16.5rem)] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm outline-none transition hover:border-slate-300 focus-within:ring-2 focus-within:ring-slate-400"
      aria-label={`${card.name}${card.category ? `, ${card.category}` : ""}`}
    >
      <Link
        href={detailsHref}
        className="block focus:outline-none"
        aria-label={`View details for ${card.name}`}
      >
        <div className="relative h-36 w-full overflow-hidden bg-slate-200">
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied Google Places photo
            <img
              src={card.photoUrl}
              alt={`Photo of ${card.name}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
              <MapPin className="h-8 w-8 text-slate-400" aria-hidden />
            </div>
          )}
        </div>
      </Link>

      <div className="space-y-2 p-3">
        <div>
          <Link
            href={detailsHref}
            className="text-sm font-semibold text-slate-900 hover:underline focus:outline-none focus-visible:underline"
          >
            {card.name}
          </Link>
          <div className="mt-1">
            <Stars rating={card.rating} />
            {card.userRatingCount > 0 ? (
              <span className="ml-1 text-[0.65rem] text-slate-500">
                ({card.userRatingCount.toLocaleString()})
              </span>
            ) : null}
          </div>
        </div>

        {card.category ? (
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
            {card.category}
          </p>
        ) : null}

        {card.address ? (
          <p className="line-clamp-2 text-[0.7rem] leading-snug text-slate-600">{card.address}</p>
        ) : null}

        {openLabel ? (
          <p
            className={`text-[0.7rem] font-semibold ${
              card.openNow ? "text-emerald-700" : "text-rose-600"
            }`}
          >
            {openLabel}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <Link
            href={detailsHref}
            className="inline-flex min-h-8 items-center rounded-lg bg-slate-900 px-2.5 text-[0.7rem] font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            View Details
          </Link>
          {card.mapsUrl ? (
            <a
              href={card.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[0.7rem] font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Open in Google Maps
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
