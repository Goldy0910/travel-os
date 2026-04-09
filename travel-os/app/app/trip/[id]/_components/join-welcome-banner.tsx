"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinWelcomeBanner({
  tripId,
  tripTitle,
}: {
  tripId: string;
  tripTitle: string;
}) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-base" aria-hidden>
            🎉
          </span>{" "}
          <span className="font-semibold">You&apos;re in!</span> Welcome to{" "}
          <span className="font-medium">{tripTitle}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            router.replace(`/app/trip/${tripId}`);
            router.refresh();
          }}
          className="shrink-0 rounded-lg bg-emerald-800 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
