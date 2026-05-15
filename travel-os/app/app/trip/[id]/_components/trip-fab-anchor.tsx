"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Tailwind bottom position, e.g. `bottom-[var(--travel-os-fab-bottom)]` */
  bottomClassName: string;
  zClassName?: string;
};

/**
 * Pins floating actions to the right edge of the 390px trip column (not the viewport edge).
 * Matches sticky itinerary actions and bottom nav content width.
 */
export default function TripFabAnchor({
  children,
  bottomClassName,
  zClassName = "z-[110]",
}: Props) {
  return (
    <div className={`pointer-events-none fixed inset-x-0 ${bottomClassName} ${zClassName}`}>
      <div className="mx-auto flex w-full max-w-[390px] justify-end px-3 pointer-events-none">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </div>
  );
}
