"use client";

import Link from "next/link";
import type { DestinationRecommendation } from "@/app/find-destination/_lib/types";
import { formatBudgetInr } from "@/app/find-destination/_lib/quiz-constants";
import { findDestinationAnalytics } from "@/app/find-destination/_lib/analytics";
import { shareDestination } from "@/app/find-destination/_lib/share";
import {
  isDestinationSaved,
  saveDestinationSlug,
  setPendingDestinationSave,
} from "@/app/find-destination/_lib/storage";
import {
  createTripHrefForSlug,
  loginThenCreateTripHref,
  loginThenSaveHref,
} from "@/app/find-destination/_lib/urls";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

function MatchBadge({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
      {score}% Match
    </span>
  );
}

export function DestinationCard({ destination }: { destination: DestinationRecommendation }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() =>
    typeof window !== "undefined" ? isDestinationSaved(destination.slug) : false,
  );
  const [busy, setBusy] = useState<"save" | "trip" | "share" | null>(null);

  const detailsHref = `/find-destination/${destination.slug}`;
  const budgetLabel = `${formatBudgetInr(destination.estimatedBudgetInr.min)} – ${formatBudgetInr(destination.estimatedBudgetInr.max)}`;

  const onSave = async () => {
    findDestinationAnalytics.saveClicked(destination.slug);
    setBusy("save");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPendingDestinationSave(destination.slug);
        router.push(loginThenSaveHref(destination.slug));
        return;
      }
      saveDestinationSlug(destination.slug);
      setSaved(true);
      toast.success("Destination saved");
    } catch {
      toast.error("Couldn’t save right now. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const onCreateTrip = async () => {
    findDestinationAnalytics.createTripClicked(destination.slug);
    setBusy("trip");
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const href = user
        ? createTripHrefForSlug(destination.slug, destination.travelPlaceSlug)
        : loginThenCreateTripHref(destination.slug, destination.travelPlaceSlug);
      router.push(href);
    } catch {
      router.push(loginThenCreateTripHref(destination.slug, destination.travelPlaceSlug));
    } finally {
      setBusy(null);
    }
  };

  const onShare = async () => {
    findDestinationAnalytics.shareClicked(destination.slug);
    setBusy("share");
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${detailsHref}`
        : detailsHref;
    const result = await shareDestination(destination.name, url);
    if (result === "copied") toast.success("Share text copied");
    if (result === "failed") toast.error("Couldn’t share. Copy the link manually.");
    setBusy(null);
  };

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50">
      <div className="relative h-44 w-full overflow-hidden bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- matching app convention (no next/image usage) */}
        <img
          src={destination.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <h3 className="text-lg font-bold text-white drop-shadow">{destination.name}</h3>
          <MatchBadge score={destination.confidenceScore} />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm leading-relaxed text-slate-600">{destination.shortDescription}</p>
        <dl className="grid grid-cols-2 gap-2 text-xs text-slate-600">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold text-slate-500">Budget</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{budgetLabel}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold text-slate-500">Duration</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{destination.idealDuration}</dd>
          </div>
          <div className="col-span-2 rounded-xl bg-slate-50 px-3 py-2">
            <dt className="font-semibold text-slate-500">Best months</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{destination.bestMonths.join(" · ")}</dd>
          </div>
        </dl>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top attractions</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {destination.topAttractions.slice(0, 4).map((a) => (
              <li
                key={a}
                className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900 ring-1 ring-teal-100"
              >
                {a}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={detailsHref}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800"
          >
            View Details
          </Link>
          <button
            type="button"
            onClick={onCreateTrip}
            disabled={busy === "trip"}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create Trip
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy === "save"}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={busy === "share"}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            Share
          </button>
        </div>
      </div>
    </article>
  );
}

export function ResultsGrid({ destinations }: { destinations: DestinationRecommendation[] }) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Matched for you</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Your Perfect Destinations
        </h2>
        <p className="mt-2 text-sm text-slate-600">Top 3 picks based on your travel vibe.</p>
      </div>
      <div className="space-y-5 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
        {destinations.map((d) => (
          <DestinationCard key={d.slug} destination={d} />
        ))}
      </div>
    </div>
  );
}
