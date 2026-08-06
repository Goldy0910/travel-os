"use client";

import DestinationInterestBadge from "@/components/destination-interest-badge";
import PlacePhotoLightbox from "@/components/place-photo-lightbox";
import SavePlaceButton from "@/components/save-place-button";
import { useDestinationInterest } from "@/components/use-destination-interest";
import { trackDestinationInterestClient } from "@/lib/destination-interest/client";
import { detectRegisteredDestinationsInText } from "@/lib/destination-interest/from-chat";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";
import type { ChatPlaceCard, EnrichedPlaceDetails } from "@/lib/places/types";
import {
  Clock,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Phone,
  Star,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type PlaceDetailsDrawerProps = {
  card: ChatPlaceCard | null;
  open: boolean;
  onClose: () => void;
};

type SectionId = "overview" | "about" | "hours" | "reviews" | "photos" | "map";

type SectionDef = {
  id: SectionId;
  label: string;
};

/** Build a proxied photo URL from a Places resource name or existing proxy URL. */
function placePhotoSrc(input: {
  photoUrl?: string | null;
  photoName?: string | null;
  maxH?: number;
}): string {
  const maxH = input.maxH ?? 800;
  const url = input.photoUrl?.trim() || "";
  if (url.startsWith("/api/place-photo")) {
    return /[?&]maxH=/.test(url)
      ? url.replace(/([?&]maxH=)\d+/, `$1${maxH}`)
      : `${url}${url.includes("?") ? "&" : "?"}maxH=${maxH}`;
  }
  const name = input.photoName?.trim() || "";
  if (name.startsWith("places/")) {
    return `/api/place-photo?name=${encodeURIComponent(name)}&maxH=${maxH}`;
  }
  if (url && !url.startsWith("places/")) return url;
  return "";
}

/**
 * Right-side place details drawer with sticky section tabs for quick navigation.
 */
export default function PlaceDetailsDrawer({ card, open, onClose }: PlaceDetailsDrawerProps) {
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [details, setDetails] = useState<EnrichedPlaceDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [tabsPinned, setTabsPinned] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const scrollingToRef = useRef<SectionId | null>(null);
  const trackedViewRef = useRef<string | null>(null);
  const resolvedDestination = resolveTopLevelDestination({
    name: details?.name || card?.name || "",
    type: "place",
    googleTypes: details?.types,
  });
  const relatedDestinations = useMemo(() => {
    const seen = new Set<string>();
    const out = resolvedDestination ? [resolvedDestination] : [];
    if (resolvedDestination) seen.add(resolvedDestination.id);
    for (const dest of detectRegisteredDestinationsInText(
      [details?.name, card?.name, details?.address, card?.address, card?.summary]
        .filter(Boolean)
        .join(" · "),
    )) {
      if (seen.has(dest.id)) continue;
      seen.add(dest.id);
      out.push(dest);
    }
    return out;
  }, [resolvedDestination, details?.name, details?.address, card?.name, card?.address, card?.summary]);
  const interestById = useDestinationInterest(relatedDestinations.map((dest) => dest.id));

  useEffect(() => {
    if (!open || !card?.placeId) {
      setDetails(null);
      setError(null);
      setLoading(false);
      setActiveSection("overview");
      setTabsPinned(false);
      setLightboxIndex(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetails(null);
    setHeroFailed(false);
    setActiveSection("overview");
    setTabsPinned(false);
    setLightboxIndex(null);

    void (async () => {
      try {
        const res = await fetch(`/api/places/${encodeURIComponent(card.placeId)}`);
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          place?: EnrichedPlaceDetails;
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.place) {
          setError(data.error || "Could not load place details");
          return;
        }
        setDetails(data.place);
      } catch {
        if (!cancelled) setError("Could not load place details");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, card?.placeId]);

  useEffect(() => {
    if (!open || !resolvedDestination) return;
    if (trackedViewRef.current === resolvedDestination.id) return;
    trackedViewRef.current = resolvedDestination.id;
    trackDestinationInterestClient(resolvedDestination.id, "DETAIL_VIEW");
  }, [open, resolvedDestination]);

  useEffect(() => {
    if (!open || lightboxIndex != null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, lightboxIndex]);

  const place = details ?? card;
  const galleryNames = (details?.photos ?? []).filter((n) => n.startsWith("places/"));
  const hasAbout = Boolean(place?.summary?.trim() || place?.address || place?.phone);
  const hasHours = Boolean(details?.openingHours?.length || place?.openNow != null);
  const hasReviews = Boolean(details?.reviews?.length);
  const hasPhotos = galleryNames.length > 0;
  const hasMap = place?.lat != null && place?.lng != null;

  const sections = useMemo(() => {
    const list: SectionDef[] = [{ id: "overview", label: "Overview" }];
    if (hasAbout) list.push({ id: "about", label: "About" });
    if (hasHours) list.push({ id: "hours", label: "Hours" });
    if (hasReviews) list.push({ id: "reviews", label: "Reviews" });
    if (hasPhotos) list.push({ id: "photos", label: "Photos" });
    if (hasMap) list.push({ id: "map", label: "Map" });
    return list;
  }, [hasAbout, hasHours, hasReviews, hasPhotos, hasMap]);

  // Track scroll: pin tabs after leaving the top, sync active section
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root) return;

    const onScroll = () => {
      setTabsPinned(root.scrollTop > 48);

      if (scrollingToRef.current) return;

      const rootTop = root.getBoundingClientRect().top;
      const offset = 88; // header + tabs approx
      let current: SectionId = "overview";
      for (const section of sections) {
        const el = root.querySelector<HTMLElement>(`[data-section="${section.id}"]`);
        if (!el) continue;
        const top = el.getBoundingClientRect().top - rootTop;
        if (top <= offset + 12) current = section.id;
      }
      setActiveSection(current);
    };

    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [open, sections, details, loading]);

  const scrollToSection = (id: SectionId) => {
    const root = scrollRef.current;
    const el = root?.querySelector<HTMLElement>(`[data-section="${id}"]`);
    if (!root || !el) return;
    setActiveSection(id);
    scrollingToRef.current = id;
    const top = el.offsetTop - 8;
    root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    window.setTimeout(() => {
      if (scrollingToRef.current === id) scrollingToRef.current = null;
    }, 450);
  };

  const hero = place
    ? placePhotoSrc({
        photoUrl: details?.photoUrl || card?.photoUrl,
        photoName: details?.photos?.[0] || card?.photoName,
        maxH: 900,
      })
    : "";
  const lightboxImages = useMemo(() => {
    const urls: string[] = [];
    const seen = new Set<string>();
    const push = (url: string) => {
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      urls.push(trimmed);
    };
    if (hero) push(hero.replace(/([?&]maxH=)\d+/, "$11600"));
    for (const name of galleryNames) {
      push(`/api/place-photo?name=${encodeURIComponent(name)}&maxH=1600`);
    }
    return urls;
  }, [hero, galleryNames]);

  if (!open || !card || !place) return null;

  const mapEmbed =
    place.lat != null && place.lng != null
      ? `https://maps.google.com/maps?q=${place.lat},${place.lng}&z=15&output=embed`
      : null;

  const tabs = (
    <div
      className={`border-b border-slate-100 bg-white/95 backdrop-blur-sm transition-shadow ${
        tabsPinned ? "shadow-sm" : ""
      }`}
      role="tablist"
      aria-label="Place sections"
    >
      <div className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => scrollToSection(section.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    // Above the map panel's own floating controls (search/zoom/place-chip bar all sit at
    // z-[500]) so this drawer always renders on top of the map instead of behind it.
    <div className="fixed inset-0 z-[520] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35"
        aria-label="Close place details"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl animate-in slide-in-from-right duration-200 sm:w-[40vw] sm:max-w-[40vw]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-slate-900">
            {place.name}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            <SavePlaceButton
              variant="icon"
              place={{
                placeId: place.placeId,
                name: place.name,
                address: place.address,
                category: place.category,
                photoName: place.photoName,
                photoUrl: place.photoUrl,
                rating: place.rating,
                mapsUrl: place.mapsUrl,
                lat: place.lat,
                lng: place.lng,
                destinationId: resolvedDestination?.id ?? null,
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Always-visible section tabs (fixed above scroll content) */}
        <div className="shrink-0">{tabs}</div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
          <section data-section="overview" className="scroll-mt-2">
            <div className="relative aspect-[16/10] w-full bg-slate-200">
              {hero && !heroFailed ? (
                <button
                  type="button"
                  className="h-full w-full cursor-zoom-in"
                  onClick={() => setLightboxIndex(0)}
                  aria-label="View photo full screen"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hero}
                    alt={`Photo of ${place.name}`}
                    className="h-full w-full object-cover"
                    onError={() => setHeroFailed(true)}
                  />
                </button>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <MapPin className="h-10 w-10 text-slate-300" aria-hidden />
                </div>
              )}
            </div>

            <div className="space-y-3 p-4">
              <div>
                {place.category ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {place.category}
                  </p>
                ) : null}
                <h3 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">
                  {place.name}
                </h3>
                {relatedDestinations.some(
                  (dest) => (interestById[dest.id]?.totalInterest ?? interestById[dest.id]?.uniqueTravelers ?? 0) > 0,
                ) ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {relatedDestinations.map((dest) => {
                      const snap = interestById[dest.id];
                      const count = snap?.totalInterest ?? snap?.uniqueTravelers ?? 0;
                      if (count < 1) return null;
                      return (
                        <DestinationInterestBadge
                          key={dest.id}
                          destinationName={dest.name}
                          count={count}
                          month={snap?.month}
                        />
                      );
                    })}
                  </div>
                ) : null}
                {place.rating != null ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-800">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                    {place.rating.toFixed(1)}
                    {place.userRatingCount > 0 ? (
                      <span className="font-normal text-slate-500">
                        ({place.userRatingCount.toLocaleString()} reviews)
                      </span>
                    ) : null}
                    {place.priceLevel ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {place.priceLevel}
                      </span>
                    ) : null}
                  </p>
                ) : null}
              </div>

              {loading ? (
                <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  Loading details…
                </p>
              ) : null}
              {error ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <SavePlaceButton
                  place={{
                    placeId: place.placeId,
                    name: place.name,
                    address: place.address,
                    category: place.category,
                    photoName: place.photoName,
                    photoUrl: place.photoUrl,
                    rating: place.rating,
                    mapsUrl: place.mapsUrl,
                    lat: place.lat,
                    lng: place.lng,
                    destinationId: resolvedDestination?.id ?? null,
                  }}
                />
                {place.mapsUrl ? (
                  <a
                    href={place.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Open in Maps
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : null}
                {place.websiteUrl ? (
                  <a
                    href={place.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Website
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          </section>

          {hasAbout ? (
            <section data-section="about" className="scroll-mt-2 space-y-3 border-t border-slate-100 px-4 py-4">
              <h4 className="text-sm font-semibold text-slate-900">About</h4>
              {place.summary ? (
                <p className="text-sm leading-6 text-slate-700">{place.summary}</p>
              ) : null}
              {place.address ? (
                <p className="flex items-start gap-2 text-sm text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  {place.address}
                </p>
              ) : null}
              {place.phone ? (
                <p className="flex items-center gap-2 text-sm text-slate-700">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <a href={`tel:${place.phone}`} className="underline-offset-2 hover:underline">
                    {place.phone}
                  </a>
                </p>
              ) : null}
            </section>
          ) : null}

          {hasHours ? (
            <section data-section="hours" className="scroll-mt-2 border-t border-slate-100 px-4 py-4">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                Hours
              </h4>
              {details?.openingHours?.length ? (
                <ul className="space-y-0.5 text-sm text-slate-600">
                  {details.openingHours.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : place.openNow != null ? (
                <p className="text-sm text-slate-600">
                  {place.openNow ? "Open now" : "Closed now"}
                </p>
              ) : null}
            </section>
          ) : null}

          {hasReviews ? (
            <section data-section="reviews" className="scroll-mt-2 border-t border-slate-100 px-4 py-4">
              <h4 className="text-sm font-semibold text-slate-900">Reviews</h4>
              <div className="mt-2 space-y-2">
                {details!.reviews.slice(0, 6).map((review, i) => (
                  <div
                    key={`${review.author}-${i}`}
                    className="rounded-xl bg-slate-50 px-3 py-2.5"
                  >
                    <p className="text-xs font-semibold text-slate-800">
                      {review.author}
                      {review.rating != null ? ` · ★ ${review.rating.toFixed(1)}` : ""}
                    </p>
                    {review.text ? (
                      <p className="mt-1 line-clamp-4 text-sm leading-5 text-slate-700">
                        {review.text}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {hasPhotos ? (
            <section data-section="photos" className="scroll-mt-2 border-t border-slate-100 px-4 py-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Photos</h4>
              <div className="grid grid-cols-2 gap-2">
                {galleryNames.slice(0, 8).map((name, index) => {
                  const src = `/api/place-photo?name=${encodeURIComponent(name)}&maxH=400`;
                  const fullIndex = lightboxImages.findIndex((url) =>
                    url.includes(encodeURIComponent(name)),
                  );
                  return (
                    <button
                      key={name}
                      type="button"
                      className="overflow-hidden rounded-xl ring-1 ring-slate-200"
                      onClick={() => setLightboxIndex(fullIndex >= 0 ? fullIndex : index)}
                      aria-label={`View photo ${index + 1} full screen`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="aspect-[4/3] w-full object-cover transition hover:opacity-95"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {hasMap && mapEmbed ? (
            <section data-section="map" className="scroll-mt-2 border-t border-slate-100 px-4 py-4 pb-8">
              <h4 className="mb-2 text-sm font-semibold text-slate-900">Map</h4>
              <iframe
                title={`Map of ${place.name}`}
                src={mapEmbed}
                className="h-52 w-full rounded-xl border border-slate-200"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </section>
          ) : null}
        </div>
      </aside>

      <PlacePhotoLightbox
        open={lightboxIndex != null && lightboxImages.length > 0}
        images={lightboxImages}
        index={lightboxIndex ?? 0}
        alt={`Photo of ${place.name}`}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}
