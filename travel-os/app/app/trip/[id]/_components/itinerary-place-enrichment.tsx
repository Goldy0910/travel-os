"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type Props = {
  tripId: string;
  enabled: boolean;
};

/**
 * Progressive hydration: links AI activities to Google Places after the timeline loads.
 */
export default function ItineraryPlaceEnrichment({ tripId, enabled }: Props) {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [matched, setMatched] = useState(0);

  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;

    let cancelled = false;

    async function run() {
      setStatus("running");
      try {
        const res = await fetch(
          `/app/trip/${encodeURIComponent(tripId)}/api/enrich-itinerary-places`,
          { method: "POST", credentials: "same-origin" },
        );
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          updated?: number;
          matched?: number;
        } | null;

        if (cancelled) return;

        if (!res.ok || !body?.ok) {
          setStatus("error");
          return;
        }

        const count = body.updated ?? body.matched ?? 0;
        setMatched(count);
        setStatus("done");
        if (count > 0) router.refresh();
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, tripId, router]);

  if (!enabled || status === "idle" || status === "done") return null;

  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50/90 px-3 py-2.5 text-xs text-teal-900"
      role="status"
      aria-live="polite"
    >
      <MapPin
        className={`h-4 w-4 shrink-0 text-teal-600 ${status === "running" ? "animate-pulse" : ""}`}
        aria-hidden
      />
      <span>
        {status === "running"
          ? "Linking activities to Google Maps…"
          : status === "error"
            ? "Map links will load when you open an activity."
            : `Linked ${matched} place${matched === 1 ? "" : "s"} on the map.`}
      </span>
    </div>
  );
}
