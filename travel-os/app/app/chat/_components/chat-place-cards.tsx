"use client";

import PlaceCard, { PlaceCardSkeleton } from "@/app/app/chat/_components/place-card";
import type { ChatPlaceCard } from "@/lib/places/types";
import { placeCardsFromMessageMetadata } from "@/lib/places/chat-place-cards";

type ChatPlaceCardsProps = {
  cards: ChatPlaceCard[];
  loading?: boolean;
};

export default function ChatPlaceCards({ cards, loading }: ChatPlaceCardsProps) {
  if (loading) {
    return (
      <div className="mt-2.5 w-full max-w-full" aria-busy="true" aria-label="Loading place cards">
        <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
          Places
        </p>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:flex lg:overflow-x-auto [scrollbar-width:thin]">
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </div>
      </div>
    );
  }

  if (!cards.length) return null;

  return (
    <div className="mt-2.5 w-full max-w-full">
      <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
        Places nearby in this reply
      </p>
      <div
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-2 md:overflow-visible lg:flex lg:overflow-x-auto [scrollbar-width:thin]"
        role="list"
        aria-label="Recommended places"
      >
        {cards.map((card) => (
          <div key={card.placeId} role="listitem">
            <PlaceCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}

export { placeCardsFromMessageMetadata };
