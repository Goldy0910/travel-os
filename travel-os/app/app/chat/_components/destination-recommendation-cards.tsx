"use client";

import { useState } from "react";
import DestinationInterestBadge from "@/components/destination-interest-badge";
import { useDestinationInterest } from "@/components/use-destination-interest";
import type { BudgetTier, ChatDestinationCard } from "@/lib/chat/destination-card-types";
import { ChevronDown, CloudSun, Plane, Star, Ticket, Wallet } from "lucide-react";

type DestinationRecommendationCardsProps = {
  cards: ChatDestinationCard[];
};

function tierTone(tier: BudgetTier): string {
  if (tier === "budget") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (tier === "moderate") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-violet-50 text-violet-900 ring-violet-200";
}

function DestinationCard({
  card,
  primary,
  totalInterest,
  month,
}: {
  card: ChatDestinationCard;
  primary: boolean;
  totalInterest?: number;
  month?: number;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const score = card.matchScore;
  const width = primary ? "w-[min(100%,20.5rem)]" : "w-[min(100%,15.5rem)]";
  const imageH = primary ? "h-40" : "h-28";

  return (
    <article
      className={`${width} shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm ${
        primary ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200 opacity-95"
      }`}
    >
      <div className={`relative w-full overflow-hidden bg-slate-200 ${imageH}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- chat cards use remote Unsplash URLs */}
        <img
          src={card.heroImageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent px-3 pb-2.5 pt-8">
          <h3 className={`font-semibold text-white ${primary ? "text-base" : "text-sm"}`}>
            {card.name}
          </h3>
          <p className="text-[0.7rem] text-white/80">{card.country}</p>
        </div>
        {primary ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-teal-600 px-2 py-0.5 text-[0.65rem] font-bold text-white shadow">
            <Star className="h-3 w-3 fill-current" aria-hidden />
            My Recommendation
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[0.65rem] font-semibold text-white">
            Alternative
          </span>
        )}
        {typeof score === "number" ? (
          <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-800 ring-1 ring-emerald-200">
            {score}% Match
          </span>
        ) : null}
      </div>

      <div className={`space-y-2.5 ${primary ? "p-3.5" : "p-3"}`}>
        <DestinationInterestBadge
          count={totalInterest ?? card.totalInterest ?? card.uniqueTravelers ?? 0}
          month={month ?? card.month}
        />
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 ${tierTone(card.budgetTier)}`}
        >
          <Wallet className="h-3 w-3" aria-hidden />
          {card.budgetLabel}
        </span>

        {card.matchNote ? (
          <p className="text-[0.7rem] leading-snug text-slate-600">{card.matchNote}</p>
        ) : null}

        {primary && card.expertOpinion ? (
          <p className="rounded-xl bg-teal-50/80 px-2.5 py-2 text-[0.7rem] leading-snug text-teal-900">
            <span className="font-semibold">My Opinion · </span>
            {card.expertOpinion}
          </p>
        ) : null}

        {primary ? (
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
        ) : null}

        {primary && card.whyReasons && card.whyReasons.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-teal-700"
            >
              Why this destination?
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${whyOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {whyOpen ? (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[0.7rem] leading-snug text-slate-700">
                {card.whyReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!primary && card.rankedLowerReasons && card.rankedLowerReasons.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-[0.65rem] leading-snug text-slate-500">
            {card.rankedLowerReasons.slice(0, 2).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}

        {primary ? (
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
        ) : null}
      </div>
    </article>
  );
}

export default function DestinationRecommendationCards({
  cards,
}: DestinationRecommendationCardsProps) {
  const interestById = useDestinationInterest(cards.map((card) => card.slug || card.id));
  if (!cards.length) return null;

  const ordered = [...cards].sort((a, b) => {
    if (a.role === "primary") return -1;
    if (b.role === "primary") return 1;
    return (b.matchScore ?? 0) - (a.matchScore ?? 0);
  });
  const hasExpertRoles = ordered.some((c) => c.role === "primary" || c.role === "alternative");

  return (
    <div className="mt-2.5 w-full max-w-full">
      <p className="mb-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
        {hasExpertRoles ? "Expert pick · destination cards" : "Destination ideas · no itinerary yet"}
      </p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {ordered.map((card, index) => {
          const snap = interestById[card.slug] ?? interestById[card.id];
          return (
            <DestinationCard
              key={card.id}
              card={card}
              primary={card.role === "primary" || (!hasExpertRoles && index === 0)}
              totalInterest={snap?.totalInterest ?? snap?.uniqueTravelers}
              month={snap?.month}
            />
          );
        })}
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
