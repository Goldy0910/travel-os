"use client";

import type { TravelGuidesBundle } from "@/lib/travelGuides";
import {
  GUIDE_CATEGORIES,
  bundleHasVideos,
  type GuideCategoryId,
} from "@/lib/travelGuides";
import { useMemo, useState } from "react";

type Filter = "all" | GuideCategoryId;

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

function GuideVideoCard({ title, youtubeId }: { title: string; youtubeId: string }) {
  const href = `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`;
  const thumb = `https://img.youtube.com/vi/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block w-[min(17.5rem,78vw)] shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-900 shadow-md ring-1 ring-slate-200/90 transition active:scale-[0.98]"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-800">
        {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube CDN; no API */}
        <img
          src={thumb}
          alt=""
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/50 via-black/20 to-black/30"
          aria-hidden
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg ring-2 ring-white/80 transition group-hover:scale-110">
            <PlayIcon className="ml-0.5 h-7 w-7" />
          </span>
        </div>
      </div>
      <p className="line-clamp-2 min-h-[2.75rem] bg-white px-3 py-2.5 text-sm font-semibold leading-snug text-slate-900">
        {title}
      </p>
    </a>
  );
}

function CategoryRow({
  label,
  videos,
}: {
  label: string;
  videos: { title: string; youtubeId: string }[];
}) {
  if (videos.length === 0) return null;

  return (
    <section className="space-y-2">
      <h3 className="px-0.5 text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </h3>
      <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => (
          <GuideVideoCard key={`${v.youtubeId}-${v.title}`} {...v} />
        ))}
      </div>
    </section>
  );
}

type Props = {
  bundle: TravelGuidesBundle | null;
  /** Shown in subtitle / empty state (e.g. raw trip location). */
  destinationLabel: string;
};

export default function TripGuidesPanel({ bundle, destinationLabel }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const visibleCategories = useMemo(() => {
    if (filter === "all") return GUIDE_CATEGORIES;
    return GUIDE_CATEGORIES.filter((c) => c.id === filter);
  }, [filter]);

  if (!bundle || !bundleHasVideos(bundle)) {
    return (
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Travel guides</h2>
          <p className="text-sm text-slate-600">
            Curated YouTube picks for your destination.
          </p>
        </header>
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            No guides available for this destination yet
          </p>
          {destinationLabel.trim() ? (
            <p className="mt-2 text-xs text-slate-500">
              Place: {destinationLabel.trim()}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Travel guides</h2>
        <p className="text-sm text-slate-600">
          Curated videos for{" "}
          <span className="font-medium text-slate-800">
            {destinationLabel.trim() || "your trip"}
          </span>
        </p>
      </header>

      <div
        className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Guide categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          onClick={() => setFilter("all")}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition touch-manipulation ${
            filter === "all"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          }`}
        >
          All
        </button>
        {GUIDE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filter === c.id}
            onClick={() => setFilter(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition touch-manipulation ${
              filter === c.id
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-8">
        {visibleCategories.map((cat) => (
          <CategoryRow
            key={cat.id}
            label={cat.label}
            videos={bundle[cat.id]}
          />
        ))}
      </div>
    </div>
  );
}
