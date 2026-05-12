"use client";

import { detectTripLanguage } from "@/app/app/_lib/detect-trip-language";
import { getEmergencyLines } from "@/app/app/_lib/emergency-lines";

type Props = {
  tripId: string;
  tripTitle: string;
  destination: string;
};

export default function EmergencyClient({ tripId, tripTitle, destination }: Props) {
  const language = detectTripLanguage(destination);
  const emergencyLines = getEmergencyLines(language);

  return (
    <div className="min-h-0 bg-[#f4f4f0] pb-8" data-trip-id={tripId}>
      <div className="mx-auto flex max-w-[390px] flex-col gap-4 px-4 py-3">
        <p className="sr-only">
          {tripTitle} — emergency and safety for {destination}
        </p>

        <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3">
          <span className="text-2xl" aria-hidden>
            🆘
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-rose-950">{destination || "Trip"}</p>
          </div>
        </div>

        <section className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-900">How to use this page</p>
          <p className="mt-1 text-xs leading-relaxed text-indigo-800">
            Use these lines during urgent situations to quickly contact local emergency services.
            If you are unsure which number to call, ask your hotel/front desk to connect you immediately.
          </p>
        </section>

        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            Emergency &amp; safety
          </p>
          <ul className="space-y-2 text-sm text-gray-700">
            {emergencyLines.map((line, i) => (
              <li key={i} className="border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            Numbers vary by country — verify with your hotel or official tourism site.
          </p>
        </div>
      </div>
    </div>
  );
}
