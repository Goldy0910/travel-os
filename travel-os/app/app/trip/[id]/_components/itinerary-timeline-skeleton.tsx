"use client";

type Props = {
  dayCount?: number;
  activitiesPerDay?: number;
};

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={`travel-os-shimmer rounded-lg ${className ?? ""}`}
      aria-hidden
    />
  );
}

export default function ItineraryTimelineSkeleton({
  dayCount = 3,
  activitiesPerDay = 2,
}: Props) {
  return (
    <div
      className="mt-4 space-y-5"
      role="status"
      aria-live="polite"
      aria-label="Loading itinerary"
    >
      <p className="flex items-center justify-center gap-2 text-center text-xs font-medium text-teal-800">
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent motion-reduce:animate-none"
          aria-hidden
        />
        Building your day-by-day plan…
      </p>
      {Array.from({ length: dayCount }).map((_, dayIdx) => (
        <div key={dayIdx} className="space-y-3">
          <ShimmerBar className="h-5 w-32" />
          {Array.from({ length: activitiesPerDay }).map((__, actIdx) => (
            <div
              key={actIdx}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex gap-3">
                <ShimmerBar className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <ShimmerBar className="h-4 w-3/4 max-w-[200px]" />
                  <ShimmerBar className="h-3 w-1/2 max-w-[140px]" />
                  <ShimmerBar className="h-3 w-2/5 max-w-[100px]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
