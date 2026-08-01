import Link from "next/link";
import LandingLink from "./landing-link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="travel-os-public-frame flex w-full items-center justify-between gap-3 px-4 py-3.5 md:px-10">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-slate-900 md:text-lg"
        >
          TravelTill99
        </Link>
        <div className="flex items-center gap-2">
          <LandingLink
            href="/find-destination"
            className="hidden min-h-11 items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 md:inline-flex"
          >
            Find destination
          </LandingLink>
          <LandingLink
            href="/app/login"
            className="inline-flex min-h-11 min-w-[5.25rem] items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold leading-none text-slate-800 shadow-sm transition active:scale-[0.98] touch-manipulation"
          >
            Log in
          </LandingLink>
        </div>
      </div>
    </header>
  );
}
