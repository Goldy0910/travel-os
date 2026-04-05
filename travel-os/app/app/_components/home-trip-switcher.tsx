"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type TripOption = { id: string; title: string };

export default function HomeTripSwitcher({
  trips,
  currentId,
}: {
  trips: TripOption[];
  currentId: string;
}) {
  const router = useRouter();
  const [navPending, startTransition] = useTransition();

  if (trips.length <= 1) return null;

  return (
    <div className="mt-3">
      <label className="block">
        <span className="sr-only">Switch trip</span>
        <select
          value={currentId}
          disabled={navPending}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(() => {
              router.push(id ? `/app/home?trip=${encodeURIComponent(id)}` : "/app/home");
            });
          }}
          className="min-h-11 w-full max-w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-white/20 disabled:opacity-60"
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id} className="bg-slate-900 text-white">
              {t.title}
            </option>
          ))}
        </select>
      </label>
      {navPending ? (
        <p className="mt-2 flex items-center gap-2 text-xs font-medium text-white/85">
          <ButtonSpinner className="h-3.5 w-3.5 text-white" />
          Switching trip…
        </p>
      ) : null}
    </div>
  );
}
