"use client";

import LandingLink from "./landing-link";

/** Sticky CTA for mobile browsers; hidden on desktop web where the hero already has CTAs. */
export default function StickyMobileCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
      <div className="pointer-events-auto min-w-0 w-full max-w-md overflow-hidden rounded-t-2xl border border-b-0 border-sky-100 bg-white/95 p-3 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md">
        <LandingLink
          href="/app/login"
          className="box-border flex min-h-12 w-full max-w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white transition active:scale-[0.99] touch-manipulation"
        >
          Plan your trip →
        </LandingLink>
      </div>
    </div>
  );
}
