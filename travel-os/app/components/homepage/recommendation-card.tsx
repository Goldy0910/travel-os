"use client";

import type { RecommendationPayload } from "@/lib/homepage-decision/types";
import ButtonSpinner from "@/app/app/_components/button-spinner";
import DestinationInterestBadge from "@/components/destination-interest-badge";
import { useDestinationInterest } from "@/components/use-destination-interest";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";
import {
  ChevronRight,
  Clock,
  IndianRupee,
  MapPin,
  RefreshCw,
  Route,
  Share2,
} from "lucide-react";

type Props = {
  data: RecommendationPayload;
  continuing?: boolean;
  onContinuePlanning: () => void;
  onShare: () => void;
  onRefine: () => void;
};

export default function RecommendationCard({
  data,
  continuing,
  onContinuePlanning,
  onShare,
  onRefine,
}: Props) {
  const destinationId =
    data.destinationSlug ||
    resolveTopLevelDestination({ name: data.destination, type: "city" })?.id ||
    "";
  const interestById = useDestinationInterest(destinationId ? [destinationId] : []);
  const interest = destinationId ? interestById[destinationId] : undefined;
  return (
    <article className="homepage-result-enter space-y-5 rounded-3xl border border-teal-100/80 bg-white p-5 shadow-xl shadow-teal-900/5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
          ⭐ My Recommendation
        </p>
        <h3 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <MapPin className="h-6 w-6 shrink-0 text-teal-600" aria-hidden />
          {data.destination}
          {typeof data.matchScore === "number" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
              {data.matchScore}% Match
            </span>
          ) : null}
        </h3>
        {data.canonicalLocation ? (
          <p className="mt-1 text-sm text-slate-500">{data.canonicalLocation}</p>
        ) : null}
        <div className="mt-2">
          <DestinationInterestBadge
            count={interest?.totalInterest ?? 0}
            month={interest?.month}
          />
        </div>
      </header>

      <section>
        <h4 className="text-sm font-semibold text-slate-800">Why I&apos;m recommending this</h4>
        <ul className="mt-2 space-y-2">
          {data.whyItFits.map((line) => (
            <li
              key={line}
              className="flex gap-2 text-sm leading-relaxed text-slate-600"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {data.expertOpinion ? (
        <section className="rounded-2xl bg-teal-50/80 p-4">
          <h4 className="text-sm font-semibold text-teal-900">My Opinion</h4>
          <p className="mt-1.5 text-sm leading-relaxed text-teal-900/90">{data.expertOpinion}</p>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Route className="h-4 w-4" aria-hidden />
            Travel effort
          </div>
          <p className="mt-2 text-sm font-medium text-slate-800">{data.travelEffort}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <IndianRupee className="h-4 w-4" aria-hidden />
            Budget estimate
          </div>
          <p className="mt-2 text-sm font-medium text-slate-800">{data.budgetEstimate}</p>
        </div>
      </div>

      <section>
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Clock className="h-4 w-4 text-teal-600" aria-hidden />
          High-level itinerary
        </h4>
        <ol className="mt-3 space-y-2">
          {data.itinerary.map((day, i) => (
            <li
              key={day}
              className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm text-slate-700"
            >
              <span className="font-medium text-teal-800">Day {i + 1}</span>
              <span className="text-slate-400"> · </span>
              {day.replace(/^Day \d+:\s*/i, "")}
            </li>
          ))}
        </ol>
      </section>

      {data.alternatives.length > 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Why they ranked lower
          </p>
          <ul className="mt-2 space-y-2">
            {data.alternatives.map((alt) => (
              <li key={alt.name} className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">{alt.name}</span>
                {" — "}
                {alt.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.decisionHelper && data.decisionHelper.length > 0 ? (
        <section>
          <h4 className="text-sm font-semibold text-slate-800">Decision helper</h4>
          <div className="mt-2 space-y-3">
            {data.decisionHelper.map((row) => (
              <div key={row.destination} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                <p className="text-sm font-medium text-slate-800">
                  Choose {row.destination} if…
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-slate-600">
                  {row.chooseIf.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-2">
        <button
          type="button"
          disabled={continuing}
          onClick={onContinuePlanning}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] touch-manipulation disabled:opacity-80"
        >
          {continuing ? (
            <>
              <ButtonSpinner className="h-4 w-4 text-white" />
              Continuing…
            </>
          ) : (
            <>
              Continue Planning
              <ChevronRight className="h-4 w-4" aria-hidden />
            </>
          )}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onShare}
            disabled={continuing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition active:scale-[0.98] touch-manipulation disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </button>
          <button
            type="button"
            onClick={onRefine}
            disabled={continuing}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900 transition active:scale-[0.98] touch-manipulation disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refine
          </button>
        </div>
      </div>
    </article>
  );
}
