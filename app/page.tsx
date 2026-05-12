import type { ReactNode } from "react";
import Footer from "./components/landing/Footer";
import LandingLink from "./components/landing/landing-link";
import Navbar from "./components/landing/Navbar";
import StickyMobileCta from "./components/landing/StickyMobileCta";

const painPoints = [
  "Too many possible destinations",
  "Don’t know what fits the time I have",
  "Planning feels like too much effort",
  "Have a place in mind, not sure it’s right",
];

const features = [
  {
    title: "Suggest a trip",
    description:
      "Don’t know where to go? Tell us your days and we’ll recommend the best-fit destination.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09zM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.456-2.456L14.25 6l1.035-.259a3.375 3.375 0 0 0 2.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456zM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423z"
      />
    ),
  },
  {
    title: "Check a place in mind",
    description:
      "Already thinking of somewhere? We’ll confirm it, reframe it, or suggest a better fit.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
  {
    title: "Turn it into a plan",
    description:
      "Every recommendation comes with a usable plan you can refine in plain English.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"
      />
    ),
  },
];

const steps = [
  {
    n: "1",
    title: "Tell us two things",
    body: "How many days, and what matters most. That’s it.",
  },
  {
    n: "2",
    title: "Get a recommendation",
    body: "One clear destination, why it fits, and a plan that’s ready to use.",
  },
  {
    n: "3",
    title: "Refine and save",
    body: "“Make it cheaper.” “Add cafés.” Your trip updates as you talk.",
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
                Get ready to decide
              </p>
              <h1 className="mt-2 text-[1.65rem] font-bold leading-[1.2] tracking-tight text-slate-900">
                Decide your next trip. In 60 seconds.
              </h1>
              <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate-600">
                Tell us how many days you have and what matters. We’ll tell you
                where to go — and turn it into a plan you can act on.
              </p>
              <div className="mt-7 flex w-full flex-col gap-3">
                <LandingLink
                  href="/app/login"
                  className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-lg transition active:scale-[0.98] touch-manipulation"
                >
                  Plan my trip
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
                Travel OS helps you decide.
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Most trips stall before they begin — not because planning is
                hard, but because deciding is. We turn intent into a confident
                trip in under a minute.
              </p>
            </div>
          </section>

          {/* Features — single column */}
          <section className="px-4 py-10">
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Three ways to use it
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Whatever stage you’re at, the product meets you there.
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
                  label: "Decide",
                  bars: ["w-3/4", "w-full", "w-5/6"],
                  accent: "bg-teal-500",
                },
                {
                  label: "Trip card",
                  bars: ["w-full", "w-4/5", "w-full", "w-2/3"],
                  accent: "bg-sky-500",
                },
                {
                  label: "Refine",
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
                What should you do with your next free weekend?
              </h2>
              <p className="relative mt-2 text-xs text-slate-300">
                Find out in 60 seconds. Free to try.
              </p>
              <LandingLink
                href="/app/create-trip"
                prefetch={false}
                className="relative mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-md transition active:scale-[0.98] touch-manipulation"
              >
                Plan my trip
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
