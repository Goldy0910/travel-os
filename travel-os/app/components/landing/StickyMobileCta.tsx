"use client";

import LandingLink from "./landing-link";

export default function StickyMobileCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-5">
      <div className="pointer-events-auto w-full max-w-[420px] rounded-t-2xl border border-b-0 border-slate-200 bg-white/95 px-3 pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.08)] backdrop-blur-md md:rounded-b-[2.5rem] md:border-b md:shadow-xl">
        <LandingLink
          href="/app/login"
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-base font-semibold text-white transition active:scale-[0.99] touch-manipulation"
        >
          Start your trip
        </LandingLink>
      </div>
    </div>
  );
}
