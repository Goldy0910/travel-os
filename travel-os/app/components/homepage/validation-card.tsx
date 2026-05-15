"use client";

import type { ValidationPayload } from "@/lib/homepage-decision/types";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  IndianRupee,
  MapPin,
  RefreshCw,
  Route,
  Share2,
} from "lucide-react";

type Props = {
  data: ValidationPayload;
  continuing?: boolean;
  onContinuePlanning: () => void;
  onShare: () => void;
  onRefine: () => void;
};

const FIT_STYLES = {
  strong: {
    label: "Strong Fit",
    icon: CheckCircle2,
    badge: "bg-emerald-100 text-emerald-900 border-emerald-200",
    ring: "border-emerald-100",
  },
  okay: {
    label: "Moderate Fit",
    icon: HelpCircle,
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    ring: "border-amber-100",
  },
  weak: {
    label: "Weak Fit",
    icon: AlertTriangle,
    badge: "bg-rose-100 text-rose-900 border-rose-200",
    ring: "border-rose-100",
  },
} as const;

export default function ValidationCard({
  data,
  continuing,
  onContinuePlanning,
  onShare,
  onRefine,
}: Props) {
  const fit = FIT_STYLES[data.fit];
  const FitIcon = fit.icon;

  return (
    <article
      className={`homepage-result-enter space-y-5 rounded-3xl border bg-white p-5 shadow-xl shadow-slate-900/5 ${fit.ring}`}
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Destination check
        </p>
        <h3 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <MapPin className="h-6 w-6 shrink-0 text-teal-600" aria-hidden />
          {data.destination}
        </h3>
        <span
          className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${fit.badge}`}
        >
          <FitIcon className="h-4 w-4" aria-hidden />
          {fit.label}
        </span>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{data.summary}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="Travel effort" icon={Route} value={data.travelEffort} />
        <Metric label="Practicality" icon={CheckCircle2} value={data.practicality} />
        <Metric label="Time fit" icon={HelpCircle} value={data.timeFit} />
        <Metric label="Budget realism" icon={IndianRupee} value={data.budgetRealism} />
      </div>

      {data.fit === "weak" && data.alternatives.length > 0 ? (
        <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-900">Better alternatives</p>
          <ul className="mt-2 space-y-2">
            {data.alternatives.map((alt) => (
              <li key={alt.name} className="text-sm text-rose-900/90">
                <span className="font-medium">{alt.name}</span>
                {" — "}
                {alt.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-2">
        <ActionButton
          primary
          onClick={onContinuePlanning}
          icon={ChevronRight}
          label={continuing ? "Continuing…" : "Continue Planning"}
          disabled={continuing}
          fullWidth
        />
        <div className="grid grid-cols-2 gap-2">
          <ActionButton onClick={onShare} icon={Share2} label="Share" disabled={continuing} />
          <ActionButton onClick={onRefine} icon={RefreshCw} label="Refine" tinted disabled={continuing} />
        </div>
      </div>
    </article>
  );
}

function Metric({
  label,
  icon: Icon,
  value,
}: {
  label: string;
  icon: typeof Route;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-slate-800">{value}</p>
    </div>
  );
}

function ActionButton({
  onClick,
  icon: Icon,
  label,
  primary,
  tinted,
  disabled,
  fullWidth,
}: {
  onClick: () => void;
  icon: typeof ChevronRight;
  label: string;
  primary?: boolean;
  tinted?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] touch-manipulation disabled:opacity-60";
  const cls = primary
    ? `${base} bg-slate-900 text-white shadow-md${fullWidth ? " w-full" : ""}`
    : tinted
      ? `${base} border border-teal-200 bg-teal-50 text-teal-900`
      : `${base} border border-slate-200 bg-white text-slate-700`;

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}
