"use client";

import type { NormalizedTripPlan } from "@/lib/unified-trip";
import type { MasterTripFile } from "@/lib/master-trip-file";
import TripManageMenu from "../trip-manage-menu";
import { Calendar, CloudSun, IndianRupee, MapPin, Route, Sparkles } from "lucide-react";
import Image from "next/image";

type Props = {
  destinationName: string;
  dateRangeLabel: string;
  dayCount: number;
  memberCount: number;
  heroImageUrl?: string | null;
  plan: NormalizedTripPlan | null;
  masterFile: MasterTripFile | null;
  tripId: string;
  canDeleteTrip?: boolean;
  onEditTrip: () => void;
};

function vibeFromPlan(plan: NormalizedTripPlan | null, file: MasterTripFile | null): string {
  if (plan?.summary?.trim()) return plan.summary.trim();
  if (file?.recommendation.explanation?.trim()) return file.recommendation.explanation.trim();
  return "Your AI-powered trip workspace — edit every stop on the timeline below.";
}

export default function ItineraryHeroSummary({
  destinationName,
  dateRangeLabel,
  dayCount,
  memberCount,
  heroImageUrl,
  plan,
  masterFile,
  tripId,
  canDeleteTrip = false,
  onEditTrip,
}: Props) {
  const vibe = vibeFromPlan(plan, masterFile);
  const budget = plan?.budget || masterFile?.practical.budgetEstimate || "—";
  const effort = plan?.travelEffort || masterFile?.practical.travelEffort || "—";
  const weather = plan?.weather?.trim();

  return (
    <section className="relative overflow-hidden rounded-3xl shadow-lg shadow-slate-900/10">
      <div className="relative h-44 w-full sm:h-48">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 390px) 100vw, 390px"
            priority
            fetchPriority="high"
            placeholder="blur"
            blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTRiOGE2Ii8+PC9zdmc+"
            unoptimized={heroImageUrl.includes("/api/place-photo")}
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-teal-700 via-teal-600 to-indigo-800"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/40 to-slate-900/20" />
        <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
          <Sparkles className="h-3 w-3" aria-hidden />
          AI trip workspace
        </div>
      </div>

      <div className="relative -mt-6 px-4 pb-4">
        <div className="rounded-2xl border border-white/10 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-slate-900">
                <MapPin className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                <span className="truncate">{destinationName}</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" aria-hidden />
                  {dayCount} days · {dateRangeLabel}
                </span>
                <span>
                  {memberCount} member{memberCount === 1 ? "" : "s"}
                </span>
              </p>
            </div>
            <TripManageMenu
              tripId={tripId}
              canDeleteTrip={canDeleteTrip}
              onEditTrip={onEditTrip}
              variant="hero"
            />
          </div>

          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{vibe}</p>

          {plan?.whyThisFits?.[0] ? (
            <p className="mt-2 text-xs font-medium text-teal-800">✓ {plan.whyThisFits[0]}</p>
          ) : null}

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <Route className="h-3 w-3" /> Effort
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-800">
                {effort}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <IndianRupee className="h-3 w-3" /> Budget
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-800">
                {budget}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-2.5 py-2">
              <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-slate-500">
                <CloudSun className="h-3 w-3" /> Weather
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-800">
                {weather || "Check before you go"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
