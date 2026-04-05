"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useLinkStatus } from "next/link";

type Props = {
  /** Tailwind classes for the fixed-size wrapper (prevents layout shift) */
  className?: string;
  spinnerClassName?: string;
};

/**
 * Must render as a descendant of next/link. Shows a spinner while the link’s navigation is pending.
 */
export default function LinkLoadingIndicator({
  className = "inline-flex h-4 w-4 shrink-0 items-center justify-center",
  spinnerClassName = "h-3.5 w-3.5 text-current",
}: Props) {
  const { pending } = useLinkStatus();
  return (
    <span className={className} aria-hidden={!pending}>
      {pending ? <ButtonSpinner className={spinnerClassName} /> : null}
    </span>
  );
}
