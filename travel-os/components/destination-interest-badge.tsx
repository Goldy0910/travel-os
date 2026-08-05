"use client";

import { formatDestinationInterestLabel } from "@/lib/destination-interest/format";

export type DestinationInterestBadgeProps = {
  count: number;
  month?: number;
  className?: string;
};

export default function DestinationInterestBadge({
  count,
  month,
  className,
}: DestinationInterestBadgeProps) {
  const label = formatDestinationInterestLabel(count, month);
  if (!label) return null;

  return (
    <p
      className={
        className ??
        "text-[0.7rem] font-medium leading-snug text-slate-600"
      }
      data-testid="destination-interest-badge"
    >
      {label}
    </p>
  );
}
