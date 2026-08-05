"use client";

import LoadingExperience from "@/app/find-destination/_components/loading-experience";
import { ResultsGrid } from "@/app/find-destination/_components/destination-card";
import {
  OptionChip,
  PrimaryButton,
  QuizProgress,
  SecondaryButton,
} from "@/app/find-destination/_components/quiz-ui";
import { findDestinationAnalytics } from "@/app/find-destination/_lib/analytics";
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP,
  COMPANION_OPTIONS,
  DURATION_OPTIONS,
  INTEREST_OPTIONS,
  QUIZ_TOTAL_STEPS,
  REGION_OPTIONS,
  TRANSPORT_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
  WEATHER_OPTIONS,
  formatBudgetInr,
} from "@/app/find-destination/_lib/quiz-constants";
import { persistQuizSession } from "@/app/find-destination/_lib/storage";
import type {
  CompanionOption,
  DestinationRecommendation,
  DurationOption,
  InterestOption,
  QuizAnswers,
  RegionPreference,
  RecommendationResponse,
  TransportOption,
  TravelStyleOption,
  WeatherOption,
} from "@/app/find-destination/_lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Phase = "intro" | "quiz" | "loading" | "results" | "error";

const DEFAULT_ANSWERS: QuizAnswers = {
  companion: "couple",
  budgetInr: 80_000,
  duration: "1-week",
  weather: "pleasant",
  interests: [],
  region: "surprise",
  travelStyle: "moderate",
  transport: "any",
};

export default function FindDestinationFlow() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<QuizAnswers>(DEFAULT_ANSWERS);
  const [results, setResults] = useState<DestinationRecommendation[] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [phase, step]);

  const canContinue = useMemo(() => {
    if (step === 5) return answers.interests.length > 0;
    return true;
  }, [answers.interests.length, step]);

  const startQuiz = () => {
    findDestinationAnalytics.quizStarted();
    setPhase("quiz");
    setStep(1);
    setAnswers(DEFAULT_ANSWERS);
    setResults(null);
    setErrorMessage("");
  };

  const generate = useCallback(async (payload: QuizAnswers) => {
    setPhase("loading");
    setErrorMessage("");
    findDestinationAnalytics.quizCompleted({
      companion: payload.companion,
      region: payload.region,
      budgetInr: payload.budgetInr,
    });

    const minDelay = new Promise((r) => setTimeout(r, 2800));

    try {
      const resPromise = fetch("/api/find-destination/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const [res] = await Promise.all([resPromise, minDelay]);
      const data = (await res.json().catch(() => null)) as
        | (RecommendationResponse & { error?: string })
        | null;
      if (!res.ok || !data?.destinations?.length) {
        throw new Error(data?.error || "Couldn’t generate recommendations.");
      }
      setResults(data.destinations);
      persistQuizSession(JSON.stringify(payload), JSON.stringify(data));
      findDestinationAnalytics.recommendationGenerated({
        count: data.destinations.length,
        source: data.source,
      });
      setPhase("results");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please retry.",
      );
      setPhase("error");
    }
  }, []);

  const next = () => {
    if (step < QUIZ_TOTAL_STEPS) {
      setStep((s) => s + 1);
      return;
    }
    void generate(answers);
  };

  const back = () => {
    if (step <= 1) {
      setPhase("intro");
      return;
    }
    setStep((s) => s - 1);
  };

  const toggleInterest = (id: InterestOption) => {
    setAnswers((prev) => {
      const has = prev.interests.includes(id);
      return {
        ...prev,
        interests: has ? prev.interests.filter((x) => x !== id) : [...prev.interests, id],
      };
    });
  };

  if (phase === "intro") {
    return (
      <section className="mx-auto w-full max-w-xl space-y-6 px-1 py-2 md:max-w-2xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-100 via-white to-teal-50 p-6 shadow-sm ring-1 ring-slate-200/70">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Before you book
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="mt-2 text-2xl font-bold tracking-tight text-slate-900 outline-none"
          >
            Find Your Perfect Destination
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Answer a few quick questions. We’ll confidently recommend the best destination for
            you — plus up to two strong alternatives.
          </p>
          <div className="mt-6">
            <PrimaryButton onClick={startQuiz}>Start Quiz</PrimaryButton>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 text-sm text-slate-600">
          {[
            "8 short questions",
            "Personalized best pick + alternatives",
            "Save, share, or create a trip",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-3"
            >
              <span className="h-2 w-2 rounded-full bg-teal-500" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (phase === "loading") {
    return <LoadingExperience />;
  }

  if (phase === "error") {
    return (
      <section className="mx-auto w-full max-w-xl space-y-4 px-1 py-8 text-center md:max-w-2xl">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">
          We hit turbulence
        </h2>
        <p className="text-sm text-slate-600">{errorMessage}</p>
        <div className="space-y-2">
          <PrimaryButton onClick={() => void generate(answers)}>Retry</PrimaryButton>
          <SecondaryButton
            onClick={() => {
              setPhase("quiz");
              setStep(QUIZ_TOTAL_STEPS);
            }}
          >
            Edit answers
          </SecondaryButton>
        </div>
      </section>
    );
  }

  if (phase === "results" && results) {
    return (
      <section className="space-y-6 px-1 py-2">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only outline-none">
          Your perfect destinations
        </h1>
        <ResultsGrid destinations={results} />
        <SecondaryButton onClick={startQuiz}>Retake quiz</SecondaryButton>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-xl space-y-5 px-1 py-2 md:max-w-2xl">
      <QuizProgress step={step} total={QUIZ_TOTAL_STEPS} />
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold tracking-tight text-slate-900 outline-none"
        >
          {step === 1 && "Who are you travelling with?"}
          {step === 2 && "What’s your budget?"}
          {step === 3 && "Trip duration"}
          {step === 4 && "Preferred weather"}
          {step === 5 && "What are you into?"}
          {step === 6 && "Destination preference"}
          {step === 7 && "Travel style"}
          {step === 8 && "Preferred transport"}
        </h2>
        {step === 5 ? (
          <p className="mt-1 text-sm text-slate-500">Select as many as you like.</p>
        ) : null}
      </div>

      {step === 1 ? (
        <div className="grid grid-cols-2 gap-2">
          {COMPANION_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              selected={answers.companion === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, companion: opt.id as CompanionOption }))}
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-center text-3xl font-bold text-slate-900">
            {formatBudgetInr(answers.budgetInr)}
          </p>
          <label className="mt-6 block">
            <span className="sr-only">Budget in rupees</span>
            <input
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              value={answers.budgetInr}
              onChange={(e) =>
                setAnswers((a) => ({ ...a, budgetInr: Number(e.target.value) }))
              }
              className="w-full accent-teal-600"
            />
          </label>
          <div className="mt-2 flex justify-between text-xs font-medium text-slate-500">
            <span>{formatBudgetInr(BUDGET_MIN)}</span>
            <span>{formatBudgetInr(BUDGET_MAX)}+</span>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid grid-cols-1 gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              selected={answers.duration === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, duration: opt.id as DurationOption }))}
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid grid-cols-2 gap-2">
          {WEATHER_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              selected={answers.weather === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, weather: opt.id as WeatherOption }))}
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid grid-cols-2 gap-2">
          {INTEREST_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              multi
              selected={answers.interests.includes(opt.id)}
              onClick={() => toggleInterest(opt.id)}
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {step === 6 ? (
        <div className="grid grid-cols-1 gap-2">
          {REGION_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              selected={answers.region === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, region: opt.id as RegionPreference }))}
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {step === 7 ? (
        <div className="grid grid-cols-1 gap-2">
          {TRAVEL_STYLE_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              selected={answers.travelStyle === opt.id}
              onClick={() =>
                setAnswers((a) => ({ ...a, travelStyle: opt.id as TravelStyleOption }))
              }
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      {step === 8 ? (
        <div className="grid grid-cols-1 gap-2">
          {TRANSPORT_OPTIONS.map((opt) => (
            <OptionChip
              key={opt.id}
              selected={answers.transport === opt.id}
              onClick={() => setAnswers((a) => ({ ...a, transport: opt.id as TransportOption }))}
            >
              {opt.label}
            </OptionChip>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2 pt-2">
        <div className="w-1/3">
          <SecondaryButton onClick={back}>Back</SecondaryButton>
        </div>
        <div className="w-2/3">
          <PrimaryButton onClick={next} disabled={!canContinue}>
            {step === QUIZ_TOTAL_STEPS ? "See my destinations" : "Continue"}
          </PrimaryButton>
        </div>
      </div>
    </section>
  );
}
