"use client";

import ChatInlinePlaceCard, {
  ChatInlinePlaceCardSkeleton,
} from "@/app/app/chat/_components/chat-inline-place-card";
import MarkdownMessage from "@/app/app/chat/_components/markdown-message";
import type { ChatPlaceCard } from "@/lib/places/types";

type AssistantMessageWithPlacesProps = {
  content: string;
  cards: ChatPlaceCard[];
  loadingPlaces?: boolean;
  streaming?: boolean;
  streamingCursor?: React.ReactNode;
  onOpenPlace: (card: ChatPlaceCard) => void;
  onFocusPlaceOnMap?: (card: ChatPlaceCard) => void;
  onHoverPlace?: (card: ChatPlaceCard) => void;
  onHoverPlaceEnd?: () => void;
  /** Destination / itinerary extras rendered after the place cards. */
  extras?: React.ReactNode;
};

/**
 * Assistant reply layout:
 * 1) Readable markdown first (place names stay clickable with hover preview + map highlight)
 * 2) Horizontally scrollable place preview cards at the bottom
 */
export default function AssistantMessageWithPlaces({
  content,
  cards,
  loadingPlaces,
  streaming,
  streamingCursor,
  onOpenPlace,
  onFocusPlaceOnMap,
  onHoverPlace,
  onHoverPlaceEnd,
  extras,
}: AssistantMessageWithPlacesProps) {
  const showCards = !streaming && cards.length > 0;

  return (
    <div className="w-full space-y-3 text-sm text-slate-800">
      <div className="min-w-0">
        <MarkdownMessage
          content={content}
          places={cards}
          onPlaceOpen={onOpenPlace}
          onPlaceHover={onHoverPlace}
          onPlaceHoverEnd={onHoverPlaceEnd}
        />
        {streaming ? streamingCursor : null}
      </div>

      {loadingPlaces ? (
        <div className="w-full max-w-full" aria-busy="true" aria-label="Loading places">
          <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
            Places
          </p>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <ChatInlinePlaceCardSkeleton />
            <ChatInlinePlaceCardSkeleton />
          </div>
        </div>
      ) : null}

      {showCards ? (
        <div className="w-full max-w-full">
          <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
            Places in this reply
          </p>
          <div
            className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
            role="list"
            aria-label="Recommended places"
          >
            {cards.map((card) => (
              <div
                key={card.placeId}
                role="listitem"
                className="shrink-0"
                onMouseEnter={() => {
                  onHoverPlace?.(card);
                  onFocusPlaceOnMap?.(card);
                }}
                onMouseLeave={() => onHoverPlaceEnd?.()}
              >
                <ChatInlinePlaceCard
                  card={card}
                  onOpen={onOpenPlace}
                  onFocusOnMap={onFocusPlaceOnMap}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {extras}
    </div>
  );
}
