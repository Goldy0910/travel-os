"use client";

import type { TravelGuidesBundle } from "@/lib/travelGuides";
import {
  GUIDE_CATEGORIES,
  bundleHasVideos,
  type GuideCategoryId,
} from "@/lib/travelGuides";
import { useMemo, useState } from "react";

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

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M14 5h5v5" />
      <path d="M10 14 19 5" />
      <path d="M19 13v5a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1h5" />
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

function EmptyState({ destinationLabel }: { destinationLabel: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
      <p className="text-sm font-medium text-slate-700">Coming soon for this destination</p>
      {destinationLabel.trim() ? (
        <p className="mt-2 text-xs text-slate-500">Place: {destinationLabel.trim()}</p>
      ) : null}
    </div>
  );
}

function VideoSection({
  videos,
  destinationLabel,
}: {
  videos: { title: string; youtubeId: string }[];
  destinationLabel: string;
}) {
  if (videos.length === 0) return <EmptyState destinationLabel={destinationLabel} />;

  return (
    <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto overscroll-x-contain px-1 pb-1 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden">
      {videos.map((v) => (
        <GuideVideoCard key={`${v.youtubeId}-${v.title}`} {...v} />
      ))}
    </div>
  );
}

type Props = {
  bundle: TravelGuidesBundle | null;
  /** Shown in subtitle / empty state (e.g. raw trip location). */
  destinationLabel: string;
};

export default function TripGuidesPanel({ bundle, destinationLabel }: Props) {
  const [activeTab, setActiveTab] = useState<GuideCategoryId>("places");
  const safeBundle = useMemo(() => {
    if (!bundle) return null;
    return {
      ...bundle,
      places: Array.isArray(bundle.places) ? bundle.places : [],
      food: Array.isArray(bundle.food) ? bundle.food : [],
      essentials: {
        weather: bundle.essentials?.weather ?? "",
        language: bundle.essentials?.language ?? "",
        currency: bundle.essentials?.currency ?? "",
        fashion: bundle.essentials?.fashion ?? "",
        tips: Array.isArray(bundle.essentials?.tips) ? bundle.essentials.tips : [],
      },
      transport: Array.isArray(bundle.transport) ? bundle.transport : [],
      money: {
        atm: bundle.money?.atm ?? "",
        exchange: bundle.money?.exchange ?? "",
        tips: Array.isArray(bundle.money?.tips) ? bundle.money.tips : [],
      },
      links: Array.isArray(bundle.links) ? bundle.links : [],
    };
  }, [bundle]);

  const activeLabel = useMemo(
    () => GUIDE_CATEGORIES.find((c) => c.id === activeTab)?.label ?? "Guides",
    [activeTab],
  );

  if (!safeBundle || !bundleHasVideos(safeBundle)) {
    return (
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">Travel guides</h2>
          <p className="text-sm text-slate-600">
            Premium beta assistant for quick trip planning.
          </p>
        </header>
        <EmptyState destinationLabel={destinationLabel} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-slate-900">Travel guides</h2>
        <p className="text-sm text-slate-600">
          Plan smarter for{" "}
          <span className="font-medium text-slate-800">
            {destinationLabel.trim() || "your trip"}
          </span>
        </p>
      </header>

      <div
        className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Guide categories"
      >
        {GUIDE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={activeTab === c.id}
            onClick={() => setActiveTab(c.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition touch-manipulation ${
              activeTab === c.id
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{activeLabel}</h3>

        {activeTab === "places" ? <VideoSection videos={safeBundle.places} destinationLabel={destinationLabel} /> : null}

        {activeTab === "food" ? <VideoSection videos={safeBundle.food} destinationLabel={destinationLabel} /> : null}

        {activeTab === "essentials" ? (
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weather</p>
              <p className="mt-1.5 text-sm text-slate-700">{safeBundle.essentials.weather}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Language</p>
              <p className="mt-1.5 text-sm text-slate-700">{safeBundle.essentials.language}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Currency</p>
              <p className="mt-1.5 text-sm text-slate-700">{safeBundle.essentials.currency}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fashion</p>
              <p className="mt-1.5 text-sm text-slate-700">{safeBundle.essentials.fashion}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tips</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {safeBundle.essentials.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {activeTab === "transport" ? (
          safeBundle.transport.length > 0 ? (
            <div className="space-y-2">
              {safeBundle.transport.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="flex gap-2 text-sm text-slate-700">
                    <span className="text-slate-400">•</span>
                    <span>{item}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState destinationLabel={destinationLabel} />
          )
        ) : null}

        {activeTab === "money" ? (
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ATM</p>
              <p className="mt-1.5 text-sm text-slate-700">{safeBundle.money.atm}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exchange</p>
              <p className="mt-1.5 text-sm text-slate-700">{safeBundle.money.exchange}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tips</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {safeBundle.money.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="text-slate-400">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {activeTab === "links" ? (
          safeBundle.links.length > 0 ? (
            <div className="space-y-2">
              {safeBundle.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  <span className="truncate pr-3">{link.title}</span>
                  <LinkIcon className="h-4 w-4 shrink-0 text-slate-500" />
                </a>
              ))}
            </div>
          ) : (
            <EmptyState destinationLabel={destinationLabel} />
          )
        ) : null}
      </section>
    </div>
  );
}
