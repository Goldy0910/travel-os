import type { PublicTripShareSnapshot } from "@/lib/trip-share/types";
import { Calendar, IndianRupee, MapPin, Route } from "lucide-react";
import Image from "next/image";

type Props = {
  snapshot: PublicTripShareSnapshot;
  variant?: "page" | "preview";
  className?: string;
};

export default function TripShareCard({
  snapshot,
  variant = "page",
  className = "",
}: Props) {
  const isPreview = variant === "preview";
  const heroSrc =
    snapshot.heroImageAbsolute ?? snapshot.heroImageUrl ?? null;

  return (
    <article
      className={`overflow-hidden rounded-[1.75rem] border shadow-2xl ${
        isPreview
          ? "border-slate-200 bg-white shadow-slate-900/10"
          : "border-white/10 bg-slate-900/60 shadow-black/40 backdrop-blur-sm"
      } ${className}`}
    >
      <div className="relative aspect-[4/5] max-h-[min(52vh,420px)] w-full sm:aspect-[16/10] sm:max-h-none">
        {heroSrc ? (
          <Image
            src={heroSrc}
            alt={snapshot.destination.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
            priority={!isPreview}
            unoptimized={heroSrc.includes("/api/place-photo")}
          />
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-teal-600 via-teal-800 to-slate-900"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <p
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              isPreview ? "text-teal-700" : "text-teal-300"
            }`}
          >
            {snapshot.brand}
          </p>
          <h1 className="mt-2 flex items-start gap-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            <MapPin className="mt-1 h-7 w-7 shrink-0 text-teal-300" aria-hidden />
            <span>{snapshot.destination.name}</span>
          </h1>
          <p className="mt-1 text-sm text-white/80">{snapshot.destination.canonicalLocation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <Calendar className="h-3.5 w-3.5" aria-hidden />
              {snapshot.durationDays} days
            </span>
          </div>
        </div>
      </div>

      <div className={`space-y-5 p-5 sm:p-6 ${isPreview ? "text-slate-800" : "text-slate-100"}`}>
        <section>
          <h2
            className={`text-sm font-semibold ${
              isPreview ? "text-slate-900" : "text-white"
            }`}
          >
            Why this fits
          </h2>
          <ul className="mt-3 space-y-2.5">
            {snapshot.whyItFits.map((line) => (
              <li
                key={line}
                className={`flex gap-2.5 text-sm leading-relaxed ${
                  isPreview ? "text-slate-600" : "text-slate-300"
                }`}
              >
                <span
                  className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${
                    isPreview ? "bg-teal-500" : "bg-teal-400"
                  }`}
                  aria-hidden
                />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <div
            className={`rounded-2xl p-4 ${
              isPreview ? "bg-slate-50" : "bg-white/5 ring-1 ring-white/10"
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
                isPreview ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <Route className="h-4 w-4" aria-hidden />
              Travel effort
            </div>
            <p
              className={`mt-2 text-sm font-medium ${
                isPreview ? "text-slate-800" : "text-slate-100"
              }`}
            >
              {snapshot.travelEffort}
            </p>
          </div>
          <div
            className={`rounded-2xl p-4 ${
              isPreview ? "bg-slate-50" : "bg-white/5 ring-1 ring-white/10"
            }`}
          >
            <div
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
                isPreview ? "text-slate-500" : "text-slate-400"
              }`}
            >
              <IndianRupee className="h-4 w-4" aria-hidden />
              Budget
            </div>
            <p
              className={`mt-2 text-sm font-medium ${
                isPreview ? "text-slate-800" : "text-slate-100"
              }`}
            >
              {snapshot.budgetEstimate}
            </p>
          </div>
        </div>

        {snapshot.itineraryPreview.length > 0 ? (
          <section>
            <h2
              className={`text-sm font-semibold ${
                isPreview ? "text-slate-900" : "text-white"
              }`}
            >
              Itinerary preview
            </h2>
            <ol className="mt-3 space-y-2">
              {snapshot.itineraryPreview.map((day) => (
                <li
                  key={day.dayNumber}
                  className={`rounded-xl px-3 py-2.5 text-sm ${
                    isPreview
                      ? "border border-slate-100 bg-slate-50 text-slate-700"
                      : "border border-white/10 bg-white/5 text-slate-200"
                  }`}
                >
                  <span className="font-semibold text-teal-400">Day {day.dayNumber}</span>
                  {day.title && day.title !== day.summary ? (
                    <>
                      <span className="text-slate-500"> · </span>
                      <span className="font-medium">{day.title}</span>
                    </>
                  ) : null}
                  <p className="mt-0.5 text-slate-400">{day.summary}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </article>
  );
}
