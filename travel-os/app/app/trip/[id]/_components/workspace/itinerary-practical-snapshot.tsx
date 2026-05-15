"use client";

import type { NormalizedTripPlan } from "@/lib/unified-trip";
import type { MasterTripFile } from "@/lib/master-trip-file";
import { Backpack, Bus, CloudSun, IndianRupee, Lightbulb } from "lucide-react";

type Props = {
  plan: NormalizedTripPlan | null;
  masterFile: MasterTripFile | null;
  dayCount: number;
  /** When nested in CollapsibleSection, omit duplicate heading. */
  hideHeading?: boolean;
};

export default function ItineraryPracticalSnapshot({
  plan,
  masterFile,
  dayCount,
  hideHeading = false,
}: Props) {
  const effort = plan?.travelEffort || masterFile?.practical.travelEffort || "";
  const budget = plan?.budget || masterFile?.practical.budgetEstimate || "";
  const weather = plan?.weather?.trim();
  const dest = plan?.destination.name || masterFile?.destination.name || "your trip";

  const transport =
    effort.toLowerCase().includes("flight") || effort.toLowerCase().includes("fly")
      ? "Fly in, then use local cabs or rentals between clusters of sights."
      : effort.toLowerCase().includes("train")
        ? "Train connections work well — book seats early for popular routes."
        : `Use ride-hailing or local taxis in ${dest}; group nearby stops each day.`;

  const dailySpend = budget || "Set a daily cap in Expenses to track as you go.";

  const packing = weather
    ? `Pack for: ${weather}. Comfortable shoes and a light rain layer recommended.`
    : "Comfortable walking shoes, sun protection, and a light layer for evenings.";

  const tips = [
    masterFile?.practical.timeFit,
    masterFile?.practical.practicality,
    masterFile?.recommendation.explanation,
  ]
    .filter(Boolean)
    .slice(0, 1)[0] || `Spread highlights across ${dayCount} days — avoid stacking two long transits in one morning.`;

  const cards = [
    { icon: Bus, label: "Getting around", value: transport },
    { icon: CloudSun, label: "Weather", value: weather || "Check forecast 2–3 days before travel." },
    { icon: Backpack, label: "Packing", value: packing },
    { icon: Lightbulb, label: "Travel tip", value: tips },
    { icon: IndianRupee, label: "Daily spend", value: dailySpend },
  ];

  return (
    <section className={hideHeading ? "space-y-0" : "space-y-3"}>
      {hideHeading ? null : (
        <h2 className="px-0.5 text-sm font-bold tracking-tight text-slate-900">Practical snapshot</h2>
      )}
      <div className="grid gap-2">
        {cards.map((card) => (
          <article
            key={card.label}
            className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <card.icon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{card.value}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
