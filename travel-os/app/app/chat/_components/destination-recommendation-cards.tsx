"use client";

import type { BudgetTier, ChatDestinationCard } from "@/lib/chat/destination-card-types";
import { CloudSun, Plane, Ticket, Wallet } from "lucide-react";

type DestinationRecommendationCardsProps = {
  cards: ChatDestinationCard[];
};

function tierTone(tier: BudgetTier): string {
  if (tier === "budget") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (tier === "moderate") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-violet-50 text-violet-900 ring-violet-200";
}

function DestinationCard({ card }: { card: ChatDestinationCard }) {
  return (
    <article className="w-[min(100%,18.5rem)] shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-36 w-full overflow-hidden bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- chat cards use remote Unsplash URLs */}
        <img
          src={card.heroImageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent px-3 pb-2.5 pt-8">
          <h3 className="text-sm font-semibold text-white">{card.name}</h3>
          <p className="text-[0.7rem] text-white/80">{card.country}</p>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${tierTone(card.budgetTier)}`}
        >
          <Wallet className="h-3 w-3" aria-hidden />
          {card.budgetLabel}
        </span>

        <dl className="space-y-1.5 text-[0.7rem] text-slate-600">
          <div className="flex gap-2">
            <dt className="flex w-16 shrink-0 items-center gap-1 text-slate-400">
              <CloudSun className="h-3 w-3" aria-hidden />
              Weather
            </dt>
            <dd className="min-w-0 leading-snug text-slate-700">{card.weather}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="flex w-16 shrink-0 items-center gap-1 text-slate-400">
              <Ticket className="h-3 w-3" aria-hidden />
              Visa
            </dt>
            <dd className="min-w-0 leading-snug text-slate-700">{card.visa}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="flex w-16 shrink-0 items-center gap-1 text-slate-400">
              <Plane className="h-3 w-3" aria-hidden />
              Flight
            </dt>
            <dd className="min-w-0 leading-snug text-slate-700">{card.flightDuration}</dd>
          </div>
        </dl>

        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
            Best months
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {card.bestMonths.map((month) => (
              <span
                key={month}
                className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-700"
              >
                {month}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
            Highlights
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[0.7rem] leading-snug text-slate-700">
            {card.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {card.matchNote ? (
          <p className="border-t border-slate-100 pt-2 text-[0.7rem] leading-snug text-slate-500">
            {card.matchNote}
          </p>
        ) : null}
      </div>
    </article>
  );
}

export default function DestinationRecommendationCards({
  cards,
}: DestinationRecommendationCardsProps) {
  if (!cards.length) return null;

  return (
    <div className="mt-2.5 w-full max-w-full">
      <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
        Destination ideas · no itinerary yet
      </p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {cards.map((card) => (
          <DestinationCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

/** Read cards from assistant message metadata when present. */
export function cardsFromMessageMetadata(
  metadata: Record<string, unknown> | undefined,
): ChatDestinationCard[] {
  if (!metadata || typeof metadata !== "object") return [];
  const raw = metadata.recommendations;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ChatDestinationCard => {
    if (!item || typeof item !== "object") return false;
    const c = item as Partial<ChatDestinationCard>;
    return typeof c.id === "string" && typeof c.name === "string" && typeof c.heroImageUrl === "string";
  });
}
