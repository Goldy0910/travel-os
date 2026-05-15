"use client";

import {
  BUDGET_OPTIONS,
  DURATION_OPTIONS,
  ORIGIN_CITY_OPTIONS,
  PRIORITY_CHIPS,
} from "@/app/components/homepage/constants";
import type { BudgetTier, TripDurationPreset, TripPriority } from "@/lib/homepage-decision/types";
import { Calendar, Compass, MapPin, MapPinned, Wallet } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  duration: TripDurationPreset;
  customDays: number;
  priorities: TripPriority[];
  destination: string;
  budget: BudgetTier | null;
  originCity: string;
  onOriginCityChange: (v: string) => void;
  onDurationChange: (v: TripDurationPreset) => void;
  onCustomDaysChange: (v: number) => void;
  onTogglePriority: (p: TripPriority) => void;
  onDestinationChange: (v: string) => void;
  onBudgetChange: (v: BudgetTier | null) => void;
};

export default function QuickInputFlow(props: Props) {
  return (
    <section
      id="trip-decision-flow"
      className="scroll-mt-20 space-y-8 px-4 py-8"
      aria-label="Trip decision flow"
    >
      <Step step={1} title="How many days do you have?" icon={Calendar}>
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => {
            const selected = props.duration === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => props.onDurationChange(opt.id)}
                className={chipClass(selected)}
                aria-pressed={selected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {props.duration === "custom" ? (
          <label className="mt-3 flex items-center gap-2">
            <span className="sr-only">Custom number of days</span>
            <input
              type="number"
              min={1}
              max={30}
              value={props.customDays}
              onChange={(e) =>
                props.onCustomDaysChange(
                  Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                )
              }
              className="box-border h-12 w-full max-w-[8rem] rounded-xl border border-slate-300 px-4 text-base"
            />
            <span className="text-sm text-slate-500">days</span>
          </label>
        ) : null}
      </Step>

      <Step step={2} title="Starting from?" subtitle="Optional" icon={MapPin}>
        <div className="flex flex-wrap gap-2">
          {ORIGIN_CITY_OPTIONS.map((opt) => {
            const selected = props.originCity === opt.label;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  props.onOriginCityChange(selected ? "" : opt.label)
                }
                className={chipClass(selected)}
                aria-pressed={selected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Helps us score travel effort and practicality from your city.
        </p>
      </Step>

      <Step step={3} title="What matters most?" icon={Compass}>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_CHIPS.map((chip) => {
            const selected = props.priorities.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => props.onTogglePriority(chip.id)}
                className={chipClass(selected)}
                aria-pressed={selected}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </Step>

      <Step
        step={4}
        title="Already have a place in mind?"
        subtitle="Optional"
        icon={MapPinned}
      >
        <input
          type="text"
          value={props.destination}
          onChange={(e) => props.onDestinationChange(e.target.value)}
          placeholder="Example: Goa, Bali, Coorg"
          autoComplete="off"
          className="box-border h-12 w-full min-w-0 rounded-2xl border border-slate-300 px-4 text-base shadow-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        />
        <p className="mt-2 text-xs text-slate-500">
          Leave blank for a recommendation, or enter a place to check if it fits your trip.
        </p>
      </Step>

      <Step step={5} title="Budget" subtitle="Optional" icon={Wallet}>
        <div className="flex flex-wrap gap-2">
          {BUDGET_OPTIONS.map((opt) => {
            const selected = props.budget === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => props.onBudgetChange(selected ? null : opt.id)}
                className={chipClass(selected)}
                aria-pressed={selected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Step>
    </section>
  );
}

function Step({
  step,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  subtitle?: string;
  icon: typeof Calendar;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-md shadow-slate-200/40">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow">
          {step}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 text-teal-600" aria-hidden />
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {subtitle ? (
              <span className="text-xs font-medium text-slate-400">{subtitle}</span>
            ) : null}
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function chipClass(selected: boolean) {
  return [
    "inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-sm font-medium transition touch-manipulation",
    selected
      ? "border-teal-600 bg-teal-600 text-white shadow-md shadow-teal-900/15"
      : "border-slate-200 bg-white text-slate-700 active:bg-slate-50",
  ].join(" ");
}
