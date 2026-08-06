"use client";

import { findDestinationAnalytics } from "@/app/find-destination/_lib/analytics";
import { formatBudgetInr } from "@/app/find-destination/_lib/quiz-constants";
import { shareDestination } from "@/app/find-destination/_lib/share";
import {
  isDestinationSaved,
  saveDestinationSlug,
  setPendingDestinationSave,
} from "@/app/find-destination/_lib/storage";
import type { DestinationRecommendation } from "@/app/find-destination/_lib/types";
import {
  createTripHrefForSlug,
  loginThenCreateTripHref,
  loginThenSaveHref,
} from "@/app/find-destination/_lib/urls";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import DestinationInterestBadge from "@/components/destination-interest-badge";
import { useDestinationInterest } from "@/components/use-destination-interest";
import { trackDestinationInterestClient } from "@/lib/destination-interest/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function DestinationDetailsView({
  destination,
}: {
  destination: DestinationRecommendation;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldPersistSave = searchParams.get("saved") === "1";
  const [saved, setSaved] = useState(() => {
    if (typeof window === "undefined") return shouldPersistSave;
    return shouldPersistSave || isDestinationSaved(destination.slug);
  });

  const interestById = useDestinationInterest([destination.slug]);
  const interest = interestById[destination.slug];

  useEffect(() => {
    findDestinationAnalytics.destinationViewed(destination.slug);
    trackDestinationInterestClient(destination.slug, "DETAIL_VIEW");
    if (!shouldPersistSave) return;
    const already = isDestinationSaved(destination.slug);
    saveDestinationSlug(destination.slug);
    if (!already) {
      trackDestinationInterestClient(destination.slug, "FAVORITE");
      toast.success("Destination saved");
    }
  }, [destination.slug, shouldPersistSave]);

  const budgetLabel = `${formatBudgetInr(destination.estimatedBudgetInr.min)} – ${formatBudgetInr(destination.estimatedBudgetInr.max)}`;

  const onCreateTrip = async () => {
    findDestinationAnalytics.createTripClicked(destination.slug);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      router.push(
        user
          ? createTripHrefForSlug(destination.slug, destination.travelPlaceSlug)
          : loginThenCreateTripHref(destination.slug, destination.travelPlaceSlug),
      );
    } catch {
      router.push(loginThenCreateTripHref(destination.slug, destination.travelPlaceSlug));
    }
  };

  const onSave = async () => {
    findDestinationAnalytics.saveClicked(destination.slug);
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
      trackDestinationInterestClient(destination.slug, "FAVORITE");
      toast.success("Destination saved");
    } catch {
      toast.error("Couldn’t save right now.");
    }
  };

  const onShare = async () => {
    findDestinationAnalytics.shareClicked(destination.slug);
    const url = typeof window !== "undefined" ? window.location.href : "";
    const result = await shareDestination(destination.name, url);
    if (result === "copied") toast.success("Share text copied");
    if (result === "failed") toast.error("Couldn’t share.");
  };

  return (
    <article className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
        <div className="relative h-56 w-full bg-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={destination.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-900/20 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-100">
              {destination.country}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-white">{destination.name}</h1>
            <p className="mt-1 text-sm text-white/90">{destination.confidenceScore}% match</p>
            <div className="mt-2 text-white/90">
              <DestinationInterestBadge
                count={interest?.totalInterest ?? 0}
                month={interest?.month}
                destinationName={destination.name}
                tone="onMedia"
              />
            </div>
          </div>
        </div>
        <div className="space-y-5 p-4">
          <Section title="Overview">{destination.overview || destination.shortDescription}</Section>
          <Section title="Why this matches you">{destination.whyItMatches}</Section>
          <Section title="Best time">{destination.bestMonths.join(" · ")}</Section>
          <Section title="Weather">{destination.weatherSummary}</Section>
          <Section title="Budget">{budgetLabel}</Section>
          <Section title="Ideal duration">{destination.idealDuration}</Section>
          <Section title="Top attractions">
            <ul className="list-disc space-y-1 pl-5">
              {destination.topAttractions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </Section>
          <Section title="Food">
            <ul className="list-disc space-y-1 pl-5">
              {destination.foodHighlights.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Section>
          <Section title="Transport">{destination.transportNotes}</Section>
          <Section title="Packing tips">
            <ul className="list-disc space-y-1 pl-5">
              {destination.packingTips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Section>
          <Section title="Travel tips">
            <ul className="list-disc space-y-1 pl-5">
              {destination.travelTips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Section>
          <Section title="Safety">{destination.safetyNotes}</Section>
        </div>
      </div>

      <div className="sticky bottom-4 z-10 space-y-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
        <button
          type="button"
          onClick={onCreateTrip}
          className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 text-base font-semibold text-white"
        >
          Create Trip
        </button>
        <div className="grid grid-cols-3 gap-2">
          <Link
            href="/find-destination"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
          >
            Quiz
          </Link>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
          >
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700"
          >
            Share
          </button>
        </div>
      </div>
    </article>
  );
}
