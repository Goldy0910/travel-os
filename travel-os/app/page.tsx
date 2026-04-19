import type { ReactNode } from "react";
import Footer from "./components/landing/Footer";
import LandingLink from "./components/landing/landing-link";
import Navbar from "./components/landing/Navbar";
import StickyMobileCta from "./components/landing/StickyMobileCta";

const painPoints = [
  "Tickets in Gmail",
  "Plans in Notes",
  "Expenses in Splitwise",
  "Details in WhatsApp",
];

const features = [
  {
    title: "Itinerary",
    description: "Plan your days with a clear timeline",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5"
      />
    ),
  },
  {
    title: "Booking docs",
    description: "Keep all tickets and bookings in one place",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    ),
  },
  {
    title: "Expenses",
    description: "Track “You owe” and “You are owed” easily",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m0-12.75H21"
      />
    ),
  },
  {
    title: "Group travel",
    description: "Share trips and coordinate with friends",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    ),
  },
];

const steps = [
  {
    n: "1",
    title: "Create your trip",
    body: "Add dates and destination in seconds.",
  },
  {
    n: "2",
    title: "Add bookings & plans",
    body: "Upload docs, build your timeline, log costs.",
  },
  {
    n: "3",
    title: "Travel stress-free",
    body: "Everything you need, in your pocket.",
  },
];

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-6 w-6 text-teal-600"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function StepIcon({ step }: { step: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-base font-bold text-white shadow-md">
      {step}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-slate-200 md:flex md:min-h-screen md:items-center md:justify-center md:p-4">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col bg-white md:max-h-[min(100dvh-2rem,880px)] md:min-h-0 md:overflow-hidden md:rounded-[2rem] md:shadow-2xl md:ring-1 md:ring-slate-300/60">
        <Navbar />

        <main className="flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pb-28">
          {/* Hero */}
          <section className="relative overflow-hidden px-4 pb-10 pt-6">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-amber-50/50"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-16 top-10 h-48 w-48 rounded-full bg-teal-200/35 blur-3xl"
              aria-hidden
            />
            <div className="relative text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                After you book
              </p>
              <h1 className="mt-2 text-[1.65rem] font-bold leading-[1.2] tracking-tight text-slate-900">
                All your travel plans. Finally in one place.
              </h1>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate-600">
                Stop juggling WhatsApp chats, PDFs, and notes. Manage your
                entire trip in one simple app.
              </p>
              <div className="mt-7 flex w-full flex-col gap-3">
                <LandingLink
                  href="/app/login"
                  className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] touch-manipulation"
                >
                  Start your trip
                </LandingLink>
              </div>
            </div>
          </section>

          {/* Problem → Solution — single column */}
          <section className="border-y border-slate-100 bg-slate-50/90 px-4 py-10">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Sound familiar?
            </h2>
            <ul className="mt-4 space-y-2.5">
              {painPoints.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-sm"
                >
                  <span
                    className="flex h-2 w-2 shrink-0 rounded-full bg-rose-400"
                    aria-hidden
                  />
                  <span className="text-[0.9375rem] font-medium text-slate-800">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-5 shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">
                Travel OS brings everything together
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                One place for documents, day-by-day plans, group expenses, and
                coordination—so you spend less time searching and more time
                traveling.
              </p>
            </div>
          </section>

          {/* Features — single column */}
          <section className="px-4 py-10">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Built for real trips
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Not another generic planner—tools for life after you hit
                “confirm booking.”
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {features.map((f) => (
                <article
                  key={f.title}
                  className="rounded-2xl border border-slate-100 bg-white p-5 shadow-md shadow-slate-200/40"
                >
                  <FeatureIcon>{f.icon}</FeatureIcon>
                  <h3 className="mt-3 text-base font-bold text-slate-900">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {f.description}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* How it works — vertical only */}
          <section className="border-t border-slate-100 bg-slate-50 px-4 py-10">
            <h2 className="text-center text-xl font-bold tracking-tight text-slate-900">
              How it works
            </h2>
            <div className="mt-6 flex flex-col gap-4">
              {steps.map((s) => (
                <div
                  key={s.n}
                  className="flex gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
                >
                  <StepIcon step={s.n} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Preview — horizontal snap scroll */}
          <section id="preview" className="scroll-mt-4 px-4 py-10">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Inside the app
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Screens you’ll use on the go.
              </p>
            </div>
            <div className="mt-6 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                {
                  label: "Home",
                  bars: ["w-3/4", "w-full", "w-5/6"],
                  accent: "bg-teal-500",
                },
                {
                  label: "Itinerary",
                  bars: ["w-full", "w-4/5", "w-full", "w-2/3"],
                  accent: "bg-sky-500",
                },
                {
                  label: "Expenses",
                  bars: ["w-full", "w-1/2", "w-full"],
                  accent: "bg-emerald-500",
                },
              ].map((mock) => (
                <div
                  key={mock.label}
                  className="w-[72%] max-w-[200px] shrink-0 snap-center rounded-[1.75rem] border-[3px] border-slate-800 bg-slate-900 p-1.5 shadow-xl"
                >
                  <div className="overflow-hidden rounded-[1.25rem] bg-slate-100">
                    <div className="flex justify-center border-b border-slate-200 bg-white py-1.5">
                      <span className="h-1 w-7 rounded-full bg-slate-300" />
                    </div>
                    <div className="space-y-1.5 p-2.5">
                      <div
                        className={`h-1.5 rounded-full ${mock.accent} opacity-90`}
                      />
                      {mock.bars.map((w, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full bg-slate-300/90 ${w}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {mock.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="px-4 pb-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-5 py-10 text-center shadow-lg">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-teal-400/20 blur-2xl"
                aria-hidden
              />
              <h2 className="relative text-xl font-bold text-white">
                Start your first trip in 30 seconds
              </h2>
              <p className="relative mt-2 text-xs text-slate-300">
                Free to try. No credit card required.
              </p>
              <LandingLink
                href="/app/create-trip"
                className="relative mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-md transition active:scale-[0.98] touch-manipulation"
              >
                Create trip
              </LandingLink>
            </div>
          </section>

          <Footer />
        </main>

        <StickyMobileCta />
      </div>
    </div>
  );
}
