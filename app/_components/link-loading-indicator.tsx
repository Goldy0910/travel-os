"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useLinkStatus } from "next/link";

type Props = {
  /** Tailwind classes for the fixed-size wrapper (prevents layout shift) */
  className?: string;
  spinnerClassName?: string;
  /**
   * When true (default), keep an empty fixed-size slot while idle so layout does not jump when navigation starts.
   * When false, render nothing while idle — use when the label must stay visually centered (e.g. marketing CTAs).
   */
  reserveSpace?: boolean;
};

/**
 * Must render as a descendant of next/link. Shows a spinner while the link’s navigation is pending.
 */
export default function LinkLoadingIndicator({
  className = "inline-flex h-4 w-4 shrink-0 items-center justify-center",
  spinnerClassName = "h-3.5 w-3.5 text-current",
  reserveSpace = true,
}: Props) {
  const { pending } = useLinkStatus();
  if (!pending && !reserveSpace) {
    return null;
  }
  return (
    <span className={className} aria-hidden={!pending}>
      {pending ? <ButtonSpinner className={spinnerClassName} /> : null}
    </span>
  );
}
