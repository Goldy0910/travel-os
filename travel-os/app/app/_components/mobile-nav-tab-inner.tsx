"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useLinkStatus } from "next/link";
import type { ReactElement } from "react";

type IconComp = (props: { active: boolean }) => ReactElement;

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
        {pending ? (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <ButtonSpinner className="h-4 w-4 text-slate-800" />
          </span>
        ) : null}
        <span className={pending ? "opacity-25" : undefined}>
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
