"use client";

import type { ItineraryInsight } from "@/lib/itinerary-workspace/insights";
import {
  CloudSun,
  Compass,
  Lightbulb,
  Sunrise,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<ItineraryInsight["icon"], LucideIcon> = {
  sunrise: Sunrise,
  crowd: Users,
  weather: CloudSun,
  local: Compass,
  pace: Zap,
};

type Props = {
  insights: ItineraryInsight[];
};

export default function ItineraryAiInsights({ insights }: Props) {
  if (insights.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <Lightbulb className="h-4 w-4 text-amber-500" aria-hidden />
        <h2 className="text-sm font-bold tracking-tight text-slate-900">AI insights</h2>
      </div>
      <div className="scrollbar-hide trip-snap-x -mx-1 flex gap-2.5 overflow-x-auto pb-1 pl-1 pr-1 scroll-px-1">
        {insights.map((insight) => {
          const Icon = ICONS[insight.icon] ?? Lightbulb;
          return (
            <article
              key={insight.id}
              className="w-[min(82vw,280px)] shrink-0 snap-start rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition active:scale-[0.99] touch-manipulation"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{insight.body}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
