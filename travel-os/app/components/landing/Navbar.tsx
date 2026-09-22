import Link from "next/link";
import LandingLink from "./landing-link";

const links = [
  { href: "/find-destination", label: "Discover" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#ai-advisor", label: "AI Advisor" },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-sky-100/80 bg-white/90 backdrop-blur-md">
      <div className="travel-os-public-frame flex w-full items-center justify-between gap-3 px-4 py-3 md:px-10">
        <Link
          href="/"
          className="text-[15px] font-bold tracking-tight text-slate-900 md:text-lg"
        >
          Travel Till 99
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-sky-50 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LandingLink
            href="/app/login"
            className="inline-flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-semibold text-slate-700 touch-manipulation"
          >
            Log in
          </LandingLink>
          <LandingLink
            href="/app/login"
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] touch-manipulation"
          >
            Start your trip
          </LandingLink>
        </div>
      </div>
    </header>
  );
}
