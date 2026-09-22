import { Caveat } from "next/font/google";
import Image from "next/image";
import LandingLink from "./landing-link";
import {
  AdjustMockup,
  AdvisorMockup,
  DocsMockup,
  ExpensesMockup,
  HomeMockup,
  ItineraryMockup,
  TripHubMockup,
} from "./mockups";
import PhoneFrame from "./phone-frame";

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const chaosApps = [
  { label: "WhatsApp", tint: "bg-emerald-50 text-emerald-700", glyph: "Wa" },
  { label: "PDFs", tint: "bg-rose-50 text-rose-700", glyph: "PDF" },
  { label: "Screenshots", tint: "bg-sky-50 text-sky-700", glyph: "IMG" },
  { label: "Notes", tint: "bg-amber-50 text-amber-800", glyph: "Aa" },
  { label: "Splitwise", tint: "bg-lime-50 text-lime-800", glyph: "₹" },
  { label: "Booking links", tint: "bg-violet-50 text-violet-700", glyph: "↗" },
];

const quotes = [
  "Where are we staying?",
  "Wait, who booked this?",
  "What are we doing on Saturday?",
  "How much do I owe you?",
  "Can someone send the ticket again?",
];

const journey = [
  {
    n: "01",
    title: "Discover",
    kicker: "Not sure where to go?",
    body: "Tell Travel Till 99 what kind of trip you want and get destination ideas that actually fit your group.",
  },
  {
    n: "02",
    title: "Decide",
    kicker: "Know what you’re getting into.",
    body: "See why a place might be right for you — vibe, time, budget — and how other travelers are looking at it, before anyone books.",
  },
  {
    n: "03",
    title: "Plan",
    kicker: "Build the trip together.",
    body: "Create the itinerary, add activities, make changes, and keep everyone on the same page.",
  },
  {
    n: "04",
    title: "Organize",
    kicker: "Everything the group needs.",
    body: "Bookings, documents, notes, and the day-by-day plan live together — not across six apps.",
  },
  {
    n: "05",
    title: "Split",
    kicker: "No awkward “how much do I owe you?”",
    body: "Track expenses and see who paid, who owes, and what’s settled.",
  },
];

const pillars = [
  { icon: "📍", title: "Discover", body: "Find places that fit this trip." },
  { icon: "👥", title: "Plan together", body: "Invite friends and decide as a group." },
  { icon: "🗓️", title: "Organize", body: "Build and update the day-by-day." },
  { icon: "₹", title: "Split expenses", body: "Know who paid and who owes what." },
  { icon: "📁", title: "Keep it together", body: "Tickets, docs, and the important details." },
];

const credibility = [
  "Destination discovery",
  "AI travel advice",
  "Shared itinerary",
  "Group planning",
  "Expense splitting",
  "Trip documents",
];

function PrimaryCta({
  href,
  children,
  light = false,
}: {
  href: string;
  children: string;
  light?: boolean;
}) {
  return (
    <LandingLink
      href={href}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-6 py-3 text-base font-semibold shadow-lg transition active:scale-[0.98] touch-manipulation md:w-auto md:min-w-[12.5rem] ${
        light
          ? "bg-white text-slate-900 shadow-white/10"
          : "bg-slate-900 text-white shadow-slate-900/20"
      }`}
    >
      {children}
    </LandingLink>
  );
}

export default function LandingHome() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden px-4 pb-12 pt-7 md:px-10 md:pb-20 md:pt-12">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-100 via-white to-amber-50/70"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-16 bottom-10 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-800">
              Group trips. Made simple.
            </p>
            <h1 className="mt-3 text-[1.85rem] font-bold leading-[1.12] tracking-tight text-slate-900 md:text-5xl md:leading-[1.08]">
              Planning a trip with friends shouldn&apos;t feel like a project.
            </h1>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-slate-600 md:text-lg">
              From choosing where to go to planning the itinerary, organizing
              bookings and splitting expenses —{" "}
              <span className="font-semibold text-slate-800">
                bring the whole trip together in one place.
              </span>
            </p>
            <p
              className={`${caveat.className} mt-3 text-2xl text-sky-800 md:text-3xl`}
            >
              Discover. Plan. Travel. Together.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <PrimaryCta href="/app/login">Plan your trip →</PrimaryCta>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white/80 px-6 py-3 text-base font-semibold text-slate-800 shadow-sm touch-manipulation sm:w-auto"
              >
                See how it works
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Free to try · No credit card required
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute -left-6 top-8 hidden h-40 w-28 overflow-hidden rounded-3xl shadow-xl ring-4 ring-white sm:block">
              <Image
                src="/landing/landing-hero-friends-beach.png"
                alt="Friends on a beach trip"
                fill
                className="object-cover"
                sizes="140px"
                priority
              />
            </div>
            <div className="absolute -right-4 bottom-10 hidden h-36 w-28 overflow-hidden rounded-3xl shadow-xl ring-4 ring-white sm:block">
              <Image
                src="/landing/landing-manali-valley.png"
                alt="Mountain destination"
                fill
                className="object-cover"
                sizes="140px"
              />
            </div>
            <PhoneFrame>
              <HomeMockup />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* CHAOS */}
      <section className="border-y border-rose-100/80 bg-gradient-to-b from-rose-50/80 to-white px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            A group trip starts with excitement...
          </h2>
          <p
            className={`${caveat.className} mt-1 text-center text-2xl text-rose-700 md:text-3xl`}
          >
            ...and somehow ends up looking like this.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {chaosApps.map((app) => (
              <div
                key={app.label}
                className="rounded-2xl border border-white bg-white px-3 py-4 text-center shadow-sm"
              >
                <span
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-[11px] font-bold ${app.tint}`}
                  aria-hidden
                >
                  {app.glyph}
                </span>
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  {app.label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {quotes.map((q) => (
              <p
                key={q}
                className="rounded-full border border-rose-100 bg-white px-3.5 py-2 text-sm italic text-slate-600 shadow-sm"
              >
                “{q}”
              </p>
            ))}
          </div>
          <p className="mt-8 text-center text-xl font-bold text-slate-900 md:text-2xl">
            Your trip shouldn&apos;t live across 6 different apps.
          </p>
        </div>
      </section>

      {/* AHA */}
      <section className="px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            One trip. One place. Less chaos.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[0.95rem] leading-relaxed text-slate-600">
            Travel Till 99 brings the important parts of your trip together —
            from discovering destinations to planning with friends, organizing
            your itinerary and keeping track of expenses.
          </p>
          <div className="mt-10 grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <PhoneFrame>
              <TripHubMockup />
            </PhoneFrame>
            <ul className="grid gap-3 sm:grid-cols-2">
              {pillars.map((p) => (
                <li
                  key={p.title}
                  className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4"
                >
                  <p className="text-lg" aria-hidden>
                    {p.icon}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="scroll-mt-20 border-y border-sky-100 bg-sky-50/70 px-4 py-12 md:px-10 md:py-16"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
            From “Where should we go?” to “Let&apos;s go.”
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {journey.map((step) => (
              <article
                key={step.n}
                className="rounded-2xl border border-white bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-bold tracking-widest text-sky-700">
                  {step.n}
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {step.kicker}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AI ADVISOR */}
      <section
        id="ai-advisor"
        className="scroll-mt-20 px-4 py-12 md:px-10 md:py-16"
      >
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              AI Travel Advisor
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Not sure where to go? Just ask.
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">
              Don&apos;t chat with a generic bot. Get help deciding — based on
              time, budget, and the kind of trip your group actually wants.
            </p>
            <blockquote className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm italic text-slate-700">
              “We have 4 days, ₹25,000 each, and want beaches + nightlife. Where
              should we go?”
            </blockquote>
            <LandingLink
              href="/find-destination"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-sky-700 px-6 py-3 text-base font-semibold text-white shadow-md touch-manipulation"
            >
              Explore destinations →
            </LandingLink>
          </div>
          <PhoneFrame>
            <AdvisorMockup />
          </PhoneFrame>
        </div>
      </section>

      {/* GROUP PLANNING */}
      <section className="border-y border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div className="lg:order-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Stop being the one friend who plans everything.
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">
              Create the trip once. Invite your friends. Plan together.
            </p>
            <p
              className={`${caveat.className} mt-3 text-2xl text-emerald-800`}
            >
              Everyone knows what&apos;s happening.
            </p>
          </div>
          <PhoneFrame className="lg:order-1">
            <TripHubMockup />
          </PhoneFrame>
        </div>
      </section>

      {/* ITINERARY */}
      <section className="px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Your whole trip, at a glance.
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">
              Plans change. That&apos;s travel. Move activities around, add
              notes, and keep the itinerary updated for everyone.
            </p>
          </div>
          <PhoneFrame>
            <ItineraryMockup />
          </PhoneFrame>
        </div>
      </section>

      {/* EXPENSES */}
      <section className="border-y border-amber-100 bg-amber-50/50 px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <PhoneFrame>
            <ExpensesMockup />
          </PhoneFrame>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Because someone always asks, “Who paid for this?”
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">
              Track the money without another app. See what you paid, what you
              owe, and what you&apos;re owed.
            </p>
          </div>
        </div>
      </section>

      {/* DOCUMENTS */}
      <section className="px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
              No more “Can you send that PDF again?”
            </h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-slate-600">
              Keep tickets, booking confirmations, documents and important trip
              information together.
            </p>
          </div>
          <PhoneFrame>
            <DocsMockup />
          </PhoneFrame>
        </div>
      </section>

      {/* PLANS CHANGE */}
      <section className="overflow-hidden border-y border-slate-100 bg-slate-900 px-4 py-12 text-white md:px-10 md:py-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-4xl">
              Built for the moments when plans change.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 md:text-base">
              Flight delayed? Your 2 PM activity doesn&apos;t work anymore.
              Travel Till 99 can help rethink the day.
            </p>
            <div className="relative mt-6 h-40 overflow-hidden rounded-2xl">
              <Image
                src="/landing/landing-cafe-viewpoint.png"
                alt="A cafe with a coastal view"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 480px"
              />
            </div>
          </div>
          <PhoneFrame>
            <AdjustMockup />
          </PhoneFrame>
        </div>
      </section>

      {/* CREDIBILITY */}
      <section className="px-4 py-12 md:px-10 md:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Everything your group needs for a trip
          </h2>
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {credibility.map((item) => (
              <li
                key={item}
                className="rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-semibold text-slate-800"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-4 pb-8 md:px-10 md:pb-14">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-br from-sky-700 via-slate-900 to-emerald-900 px-5 py-12 text-center shadow-lg md:px-10 md:py-16">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl" />
          <h2 className="relative text-2xl font-bold text-white md:text-4xl">
            Your next trip starts here.
          </h2>
          <p className="relative mt-3 text-base text-sky-100">
            Less time planning. More time travelling.
          </p>
          <div className="relative mt-7 flex justify-center">
            <PrimaryCta href="/app/login" light>
              Start planning →
            </PrimaryCta>
          </div>
          <p className="relative mt-3 text-xs text-sky-200/80">
            Free to try · No credit card required
          </p>
        </div>
      </section>
    </>
  );
}
