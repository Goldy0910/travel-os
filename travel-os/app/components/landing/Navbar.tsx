import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200/90 bg-white/95 backdrop-blur-md">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-slate-900"
        >
          Travel OS
        </Link>
        <Link
          href="/app/login"
          className="inline-flex min-h-11 min-w-[5.25rem] items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition active:scale-[0.98] touch-manipulation"
        >
          Log in
        </Link>
      </div>
    </header>
  );
}
