"use client";

import type { ReactNode } from "react";

export function QuizProgress({ step, total }: { step: number; total: number }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="space-y-2" aria-label={`Question ${step} of ${total}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>
          Question {step} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function OptionChip({
  selected,
  onClick,
  children,
  multi,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition active:scale-[0.98] ${
        selected
          ? "border-teal-600 bg-teal-50 text-teal-900 shadow-sm ring-1 ring-teal-200"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-2">
        {multi ? (
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
              selected ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-transparent"
            }`}
            aria-hidden
          >
            ✓
          </span>
        ) : null}
        {children}
      </span>
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-base font-semibold text-slate-800 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
