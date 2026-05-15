"use client";

import Footer from "@/app/components/landing/Footer";
import Navbar from "@/app/components/landing/Navbar";
import HomepageHero from "@/app/components/homepage/homepage-hero";
import HomepageStickyCta from "@/app/components/homepage/homepage-sticky-cta";
import QuickInputFlow from "@/app/components/homepage/quick-input-flow";
import RecommendationAuthSheet from "@/app/components/homepage/recommendation-auth-sheet";
import RecommendationCard from "@/app/components/homepage/recommendation-card";
import ResultSkeleton from "@/app/components/homepage/result-skeleton";
import ValidationCard from "@/app/components/homepage/validation-card";
import { DURATION_OPTIONS } from "@/app/components/homepage/constants";
import { presetToDays } from "@/lib/homepage-decision/catalog";
import type {
  HomepageDecisionApiResult,
  HomepageDecisionResponse,
  TripDurationPreset,
  TripPriority,
  BudgetTier,
} from "@/lib/homepage-decision/types";
import {
  continueRecommendationPlanning,
  loadRecommendationSession,
  persistRecommendationSession,
  syncLegacyHomepageDraft,
  type RecommendationFormState,
} from "@/lib/recommendation-session";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

type FlowMode = "recommend" | "validate" | null;

export default function HomepageClient() {
  const router = useRouter();
  const flowRef = useRef<HTMLDivElement | null>(null);

  const [duration, setDuration] = useState<TripDurationPreset>("5-days");
  const [customDays, setCustomDays] = useState(5);
  const [priorities, setPriorities] = useState<TripPriority[]>([]);
  const [destination, setDestination] = useState("");
  const [budget, setBudget] = useState<BudgetTier | null>(null);
  const [originCity, setOriginCity] = useState("");
  const [flowMode, setFlowMode] = useState<FlowMode>(null);

  const [loading, setLoading] = useState(false);
  const [continuing, startContinue] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HomepageDecisionResponse | null>(null);
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [continueSuccess, setContinueSuccess] = useState(false);

  const resolvedDays =
    duration === "custom"
      ? customDays
      : (DURATION_OPTIONS.find((d) => d.id === duration)?.days ?? presetToDays(duration));

  const scrollToFlow = useCallback(() => {
    flowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const scrollToDestination = useCallback(() => {
    setFlowMode("validate");
    scrollToFlow();
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        '#trip-decision-flow input[type="text"]',
      );
      input?.focus();
    }, 400);
  }, [scrollToFlow]);

  const togglePriority = (p: TripPriority) => {
    setPriorities((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const buildPayload = useCallback(
    (mode: FlowMode) => {
      const dest = destination.trim();
      const useValidation = mode === "validate" || (mode === null && dest.length > 0);
      return {
        days: resolvedDays,
        durationPreset: duration,
        customDays: duration === "custom" ? customDays : undefined,
        priorities: priorities.length ? priorities : (["scenic"] as TripPriority[]),
        destination: useValidation ? dest : undefined,
        originCity: originCity.trim() || undefined,
        budget: budget ?? undefined,
        travelMonth: new Date().getMonth() + 1,
      };
    },
    [budget, customDays, destination, duration, originCity, priorities, resolvedDays],
  );

  const buildPreferences = useCallback(
    () => ({
      days: resolvedDays,
      durationPreset: duration,
      priorities: priorities.length ? priorities : (["scenic"] as TripPriority[]),
      budget: budget ?? undefined,
      originCity: originCity.trim() || undefined,
      travelMonth: new Date().getMonth() + 1,
    }),
    [budget, duration, originCity, priorities, resolvedDays],
  );

  const buildFormState = useCallback(
    (): RecommendationFormState => ({
      duration,
      customDays,
      priorities,
      destination,
      budget,
      originCity,
    }),
    [budget, customDays, destination, duration, originCity, priorities],
  );

  const persistSession = useCallback(
    (data: HomepageDecisionResponse) => {
      persistRecommendationSession({
        decision: data,
        preferences: buildPreferences(),
        form: buildFormState(),
        intent: "continue-planning",
      });
      const loaded = loadRecommendationSession();
      if (loaded) syncLegacyHomepageDraft(loaded);
    },
    [buildFormState, buildPreferences],
  );

  const runDecision = useCallback(
    async (mode: FlowMode) => {
      setError(null);
      setResult(null);
      setContinueSuccess(false);

      if (mode === "validate" && !destination.trim()) {
        setError("Enter a destination to check, or use Plan My Trip for recommendations.");
        scrollToFlow();
        return;
      }

      if (!priorities.length && mode !== "validate") {
        setError("Pick at least one priority so we can recommend well.");
        scrollToFlow();
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/homepage-decision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(mode)),
        });
        const json = (await res.json()) as HomepageDecisionApiResult;
        if (!json.ok) {
          setError(json.error || "Something went wrong. Try again.");
          return;
        }
        setResult(json.data);
        window.setTimeout(() => {
          document.getElementById("homepage-result")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      } catch {
        setError("Network error. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [buildPayload, destination, priorities.length, scrollToFlow],
  );

  const finishContinue = useCallback(
    async (data: HomepageDecisionResponse) => {
      const outcome = await continueRecommendationPlanning();
      if (outcome.ok) {
        setAuthSheetOpen(false);
        setContinueSuccess(true);
        toast.success("Your trip is ready");
        router.push(outcome.redirectTo);
        return;
      }
      if (outcome.needsAuth) {
        setAuthSheetOpen(true);
        return;
      }
      toast.error(outcome.error);
    },
    [router],
  );

  const handleContinuePlanning = useCallback(
    (data: HomepageDecisionResponse) => {
      persistSession(data);
      startContinue(async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) {
            setAuthSheetOpen(true);
            return;
          }
          await finishContinue(data);
        } catch {
          setAuthSheetOpen(true);
        }
      });
    },
    [finishContinue, persistSession],
  );

  const handleShare = useCallback(async (data: HomepageDecisionResponse) => {
    const title =
      data.mode === "recommendation"
        ? `TravelTill99 recommends ${data.destination}`
        : `${data.destination} — ${data.fit} fit`;
    const text =
      data.mode === "recommendation"
        ? data.whyItFits.join("\n")
        : data.summary;
    const url = typeof window !== "undefined" ? window.location.origin : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(`${title}\n${text}\n${url}`);
        toast.success("Copied to clipboard");
      }
    } catch {
      /* user cancelled */
    }
  }, []);

  const handleRefine = useCallback(() => {
    setResult(null);
    setError(null);
    setContinueSuccess(false);
    scrollToFlow();
  }, [scrollToFlow]);

  const destinationLabel = result?.destination;

  const ctaLabel = loading
    ? "Thinking…"
    : destination.trim()
      ? "Check destination"
      : "Get recommendation";

  return (
    <div className="min-h-dvh bg-slate-200 md:flex md:min-h-screen md:items-center md:justify-center md:p-4">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-white md:max-h-[min(100dvh-2rem,920px)] md:min-h-0 md:overflow-hidden md:rounded-[2rem] md:shadow-2xl md:ring-1 md:ring-slate-300/60">
        <Navbar />

        <main className="flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pb-32">
          <HomepageHero
            onPlanTrip={() => {
              setFlowMode("recommend");
              setDestination("");
              scrollToFlow();
            }}
            onCheckDestination={scrollToDestination}
          />

          <div ref={flowRef}>
            <QuickInputFlow
              duration={duration}
              customDays={customDays}
              priorities={priorities}
              destination={destination}
              budget={budget}
              originCity={originCity}
              onOriginCityChange={setOriginCity}
              onDurationChange={setDuration}
              onCustomDaysChange={setCustomDays}
              onTogglePriority={togglePriority}
              onDestinationChange={setDestination}
              onBudgetChange={setBudget}
            />
          </div>

          <section id="homepage-result" className="scroll-mt-4 px-4 pb-8">
            {loading ? <ResultSkeleton /> : null}
            {error ? (
              <div
                role="alert"
                className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
              >
                <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
                {error}
              </div>
            ) : null}
            {continueSuccess ? (
              <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
                Trip saved — opening your itinerary…
              </div>
            ) : null}
            {!loading && !result && !error ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                Complete the steps above, then tap{" "}
                <span className="font-medium text-slate-700">{ctaLabel}</span> to see
                your result.
              </p>
            ) : null}
            {!loading && result?.mode === "recommendation" ? (
              <RecommendationCard
                data={result}
                continuing={continuing}
                onContinuePlanning={() => handleContinuePlanning(result)}
                onShare={() => handleShare(result)}
                onRefine={handleRefine}
              />
            ) : null}
            {!loading && result?.mode === "validation" ? (
              <ValidationCard
                data={result}
                continuing={continuing}
                onContinuePlanning={() => handleContinuePlanning(result)}
                onShare={() => handleShare(result)}
                onRefine={handleRefine}
              />
            ) : null}
          </section>

          <Footer />
        </main>

        <HomepageStickyCta
          label={ctaLabel}
          loading={loading || continuing}
          disabled={loading || continuing}
          onClick={() =>
            runDecision(
              destination.trim() ? "validate" : flowMode === "validate" ? "validate" : "recommend",
            )
          }
        />
      </div>

      {result ? (
        <RecommendationAuthSheet
          open={authSheetOpen}
          onClose={() => setAuthSheetOpen(false)}
          destinationLabel={destinationLabel}
          onAuthenticated={async () => {
            if (result) await finishContinue(result);
          }}
        />
      ) : null}
    </div>
  );
}
