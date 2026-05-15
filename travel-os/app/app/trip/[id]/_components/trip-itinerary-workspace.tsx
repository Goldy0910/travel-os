"use client";

import type { MasterTripFile } from "@/lib/master-trip-file";
import { buildItineraryInsights } from "@/lib/itinerary-workspace/insights";
import type { NormalizedTripPlan } from "@/lib/unified-trip";
import { useCallback, useMemo, useRef } from "react";
import type { ComponentProps, ReactNode } from "react";
import TripItineraryShell from "./trip-itinerary-shell";
import ItineraryPlaceEnrichment from "./itinerary-place-enrichment";
import ItineraryTimelineSkeleton from "./itinerary-timeline-skeleton";
import ItineraryAiInsights from "./workspace/itinerary-ai-insights";
import ItineraryHeroSummary from "./workspace/itinerary-hero-summary";
import { ItineraryRefinementProvider } from "./workspace/itinerary-refinement-context";
import CollapsibleSection from "./workspace/collapsible-section";
import ItineraryPracticalSnapshot from "./workspace/itinerary-practical-snapshot";
import ItineraryQuickRefinements from "./workspace/itinerary-quick-refinements";
import { TripItineraryAssistantProvider } from "./trip-itinerary-assistant-context";
import TripRightFabStack from "./trip-right-fab-stack";
import ItineraryRefinementSheet from "./workspace/itinerary-refinement-sheet";

type ShellProps = ComponentProps<typeof TripItineraryShell>;

type Props = {
  destinationName: string;
  heroImageUrl?: string | null;
  plan: NormalizedTripPlan | null;
  masterFile: MasterTripFile | null;
  masterId?: string | null;
  masterVersion?: number;
  needsPlaceEnrichment?: boolean;
  showHydrationSkeleton?: boolean;
  shellProps: ShellProps;
  showJoinWelcome?: boolean;
  welcomeBanner?: ReactNode;
  activityFeed?: ReactNode;
};

export default function TripItineraryWorkspace({
  destinationName,
  heroImageUrl,
  plan,
  masterFile,
  masterId,
  masterVersion = 1,
  needsPlaceEnrichment = false,
  showHydrationSkeleton = false,
  shellProps,
  showJoinWelcome,
  welcomeBanner,
  activityFeed,
}: Props) {
  const manageTripRef = useRef<(() => void) | null>(null);

  const handleRegisterManageTrip = useCallback((fn: (() => void) | null) => {
    manageTripRef.current = fn;
  }, []);

  const handleManageTrip = useCallback(() => {
    manageTripRef.current?.();
  }, []);

  const dayCount = useMemo(() => {
    if (plan?.days.length) return plan.days.length;
    if (masterFile?.preferences.days) return masterFile.preferences.days;
    return Math.max(1, shellProps.orderedDates.length);
  }, [plan, masterFile, shellProps.orderedDates.length]);

  const activityTitles = useMemo(
    () =>
      shellProps.orderedDates.flatMap((d) =>
        (shellProps.grouped[d] ?? []).map((i) => i.activity_name || i.title || ""),
      ),
    [shellProps.grouped, shellProps.orderedDates],
  );

  const totalActivities = activityTitles.filter(Boolean).length;
  const averagePerDay = shellProps.orderedDates.length
    ? totalActivities / shellProps.orderedDates.length
    : totalActivities;
  const tripPace: "relaxed" | "balanced" | "packed" =
    averagePerDay >= 5 ? "packed" : averagePerDay >= 3 ? "balanced" : "relaxed";

  const insights = useMemo(
    () =>
      buildItineraryInsights({
        plan,
        destination: destinationName,
        dayCount,
        activityTitles,
        tripPace,
      }),
    [plan, destinationName, dayCount, activityTitles, tripPace],
  );

  const hasRefinement = totalActivities > 0;
  const itinerarySetupComplete = shellProps.itinerarySetupComplete !== false;

  const inner = (
    <div className="space-y-6 pb-[var(--travel-os-workspace-scroll-pad)]">
      {showJoinWelcome ? welcomeBanner : null}

      <div className="trip-workspace-enter">
        <ItineraryHeroSummary
          destinationName={destinationName}
          dateRangeLabel={shellProps.dateRangeLabel}
          dayCount={dayCount}
          memberCount={shellProps.memberCount}
          heroImageUrl={heroImageUrl}
          plan={plan}
          masterFile={masterFile}
          tripId={shellProps.tripId}
          canDeleteTrip={shellProps.canDeleteTrip}
          onEditTrip={handleManageTrip}
        />
      </div>

      <div className="trip-workspace-enter trip-workspace-enter-delay-1">
        <ItineraryAiInsights insights={insights} />
      </div>

      <section className="trip-workspace-enter trip-workspace-enter-delay-2 space-y-3">
        <div className="flex items-end justify-between gap-2 px-0.5">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Your itinerary</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Tap a stop for details · expand for comments
            </p>
          </div>
          {totalActivities > 0 ? (
            <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
              {totalActivities} stops
            </span>
          ) : null}
        </div>

        <ItineraryPlaceEnrichment
          tripId={shellProps.tripId}
          enabled={needsPlaceEnrichment}
        />

        {showHydrationSkeleton ? (
          <ItineraryTimelineSkeleton dayCount={Math.min(dayCount, 5)} />
        ) : null}

        <TripItineraryShell
          {...shellProps}
          layoutMode="workspace"
          onRegisterManageTrip={handleRegisterManageTrip}
        />
      </section>

      {hasRefinement ? (
        <div className="trip-workspace-enter trip-workspace-enter-delay-3">
          <ItineraryQuickRefinements />
        </div>
      ) : null}

      <CollapsibleSection
        title="Practical snapshot"
        subtitle="Transport, weather, packing & tips"
        defaultOpen={false}
        className="trip-workspace-enter"
      >
        <ItineraryPracticalSnapshot
          plan={plan}
          masterFile={masterFile}
          dayCount={dayCount}
          hideHeading
        />
      </CollapsibleSection>

      {activityFeed}
    </div>
  );

  const chrome = (
    <>
      {inner}
      {itinerarySetupComplete ? (
        <TripRightFabStack showRefine={hasRefinement} showAssistant />
      ) : null}
    </>
  );

  return (
    <>
      <TripItineraryAssistantProvider>
        {hasRefinement ? (
          <ItineraryRefinementProvider>
            {chrome}
            <ItineraryRefinementSheet
              tripId={shellProps.tripId}
              destination={destinationName}
            />
          </ItineraryRefinementProvider>
        ) : (
          chrome
        )}
      </TripItineraryAssistantProvider>
    </>
  );
}
