"use client";

import { useLinkStatus } from "next/link";
import type { ReactElement } from "react";

type IconComp = (props: { active: boolean }) => ReactElement;

/**
 * Bottom nav label + icon. Pending navigations dim the icon slightly; full-page
 * loading is handled by route `loading.tsx` + `PageLoader`, not inline spinners.
 */
export default function MobileNavTabInner({
  Icon,
  active,
  label,
}: {
  Icon: IconComp;
  active: boolean;
  label: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className={pending ? "opacity-40" : undefined}>
          <Icon active={active} />
        </span>
      </span>
      <span
        className={`max-w-full truncate px-0.5 text-center text-[10px] font-medium sm:text-xs ${
          active ? "text-slate-900" : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </>
  );
}
