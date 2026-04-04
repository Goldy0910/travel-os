"use client";

import { useRouter } from "next/navigation";

type TripOption = { id: string; title: string };

export default function HomeTripSwitcher({
  trips,
  currentId,
}: {
  trips: TripOption[];
  currentId: string;
}) {
  const router = useRouter();

  if (trips.length <= 1) return null;

  return (
    <label className="mt-3 block">
      <span className="sr-only">Switch trip</span>
      <select
        value={currentId}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/app/home?trip=${encodeURIComponent(id)}` : "/app/home");
        }}
        className="min-h-11 w-full max-w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium text-white outline-none ring-2 ring-transparent focus:border-white/40 focus:ring-white/20"
      >
        {trips.map((t) => (
          <option key={t.id} value={t.id} className="bg-slate-900 text-white">
            {t.title}
          </option>
        ))}
      </select>
    </label>
  );
}
