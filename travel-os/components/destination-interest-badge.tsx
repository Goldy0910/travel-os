"use client";

import {
  formatDestinationInterestLabel,
  formatDestinationInterestShortLabel,
} from "@/lib/destination-interest/format";

export type DestinationInterestBadgeProps = {
  count: number;
  month?: number;
  /** When set, shows as “Manali · N travelers explored this month”. */
  destinationName?: string;
  /** `onMedia` for photo hero overlays. */
  tone?: "default" | "onMedia";
  className?: string;
};

export default function DestinationInterestBadge({
  count,
  month,
  destinationName,
  tone = "default",
  className,
}: DestinationInterestBadgeProps) {
  const fullLabel = formatDestinationInterestLabel(count, month);
  const shortLabel = formatDestinationInterestShortLabel(count);
  if (!fullLabel || !shortLabel) return null;

  const value = Math.floor(count).toLocaleString("en-US");
  const title = destinationName ? `${destinationName} — ${fullLabel}` : fullLabel;
  const onMedia = tone === "onMedia";

  return (
    <span
      title={title}
      aria-label={title}
      data-testid="destination-interest-badge"
      className={[
        "inline-flex max-w-full items-center gap-1.5 rounded-xl border px-2 py-1",
        onMedia
          ? "border-white/25 bg-slate-950/45 text-white shadow-sm backdrop-blur-[2px]"
          : "border-slate-200/90 bg-white/95 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {destinationName ? (
        <>
          <span
            className={`truncate text-[0.72rem] font-semibold tracking-tight ${
              onMedia ? "text-white" : "text-slate-800"
            }`}
          >
            {destinationName}
          </span>
          <span
            className={`h-3 w-px shrink-0 ${onMedia ? "bg-white/30" : "bg-slate-200"}`}
            aria-hidden
          />
        </>
      ) : null}
      <span
        className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md px-1.5 text-[0.7rem] font-bold tabular-nums ring-1 ${
          onMedia
            ? "bg-white/95 text-teal-800 ring-white/40"
            : "bg-teal-50 text-teal-800 ring-teal-100"
        }`}
        aria-hidden
      >
        {value}
      </span>
      <span
        className={`truncate text-[0.65rem] font-medium leading-none ${
          onMedia ? "text-white/80" : "text-slate-500"
        }`}
      >
        {shortLabel}
      </span>
    </span>
  );
}
