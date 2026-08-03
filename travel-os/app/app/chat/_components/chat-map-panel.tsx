"use client";

import type { ChatPlaceCard } from "@/lib/places/types";
import { Layers, MapPin, Search, Star, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

type ChatMapPanelProps = {
  places: ChatPlaceCard[];
  focusedPlaceId?: string | null;
  onSelectPlace: (card: ChatPlaceCard) => void;
  className?: string;
};

type MapPoint = ChatPlaceCard & { lat: number; lng: number };

type HoverPreview = {
  place: MapPoint;
  x: number;
  y: number;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function withCoords(places: ChatPlaceCard[]): MapPoint[] {
  const out: MapPoint[] = [];
  for (const p of places) {
    const lat = toFiniteNumber(p.lat);
    const lng = toFiniteNumber(p.lng);
    if (lat == null || lng == null) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    out.push({ ...p, lat, lng });
  }
  return out;
}

function pinIconHtml(active: boolean) {
  const fill = active ? "#0f172a" : "#e11d48";
  const ring = active ? "#38bdf8" : "#ffffff";
  return `<div style="width:28px;height:28px;transform:translate(-50%,-100%);filter:drop-shadow(0 2px 4px rgba(15,23,42,.35));">
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 1.5c-5.1 0-9.2 4-9.2 9 0 6.4 9.2 16 9.2 16s9.2-9.6 9.2-16c0-5-4.1-9-9.2-9z" fill="${fill}" stroke="${ring}" stroke-width="2"/>
      <circle cx="14" cy="10.5" r="3.2" fill="${ring}"/>
    </svg>
  </div>`;
}

function previewSnippet(place: MapPoint): string {
  const text = (place.summary || place.address || "").trim();
  if (!text) {
    if (place.rating != null) {
      return `Rated ${place.rating.toFixed(1)} — tap for full details.`;
    }
    return "Tap for photos, hours, and reviews.";
  }
  return text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text;
}

/**
 * Right-side explore map with Leaflet pins.
 * Hover → short preview card. Click → opens full details drawer (parent).
 */
export default function ChatMapPanel({
  places,
  focusedPlaceId,
  onSelectPlace,
  className = "",
}: ChatMapPanelProps) {
  const points = useMemo(() => withCoords(places), [places]);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const onSelectRef = useRef(onSelectPlace);
  onSelectRef.current = onSelectPlace;
  const [mapReady, setMapReady] = useState(false);
  const [hover, setHover] = useState<HoverPreview | null>(null);
  const hoverPlaceIdRef = useRef<string | null>(null);
  const pointsKey = points.map((p) => `${p.placeId}:${p.lat},${p.lng}`).join("|");

  const updateHoverPosition = (place: MapPoint) => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    const pt = map.latLngToContainerPoint([place.lat, place.lng]);
    setHover({ place, x: pt.x, y: pt.y });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let map: LeafletMap | null = null;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView([20.5937, 78.9629], 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on("movestart zoomstart", () => {
        // Hide preview while the map moves so it doesn't float off the pin
        hoverPlaceIdRef.current = null;
        setHover(null);
      });

      mapRef.current = map;
      setMapReady(true);

      requestAnimationFrame(() => {
        map?.invalidateSize();
      });
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          map?.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markersRef.current.clear();
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
      setHover(null);
    };
  }, []);

  // Rebuild markers when the place set changes
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || mapRef.current !== map) return;

      for (const marker of markersRef.current.values()) {
        marker.remove();
      }
      markersRef.current.clear();
      hoverPlaceIdRef.current = null;
      setHover(null);

      if (points.length === 0) {
        map.setView([20.5937, 78.9629], 5);
        return;
      }

      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));

      for (const p of points) {
        const active = p.placeId === focusedPlaceId;
        const icon = L.divIcon({
          className: "chat-map-pin",
          html: pinIconHtml(active),
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const marker = L.marker([p.lat, p.lng], {
          icon,
          riseOnHover: true,
          zIndexOffset: active ? 1000 : 0,
          title: p.name,
        });

        marker.on("mouseover", () => {
          hoverPlaceIdRef.current = p.placeId;
          updateHoverPosition(p);
        });
        marker.on("mouseout", () => {
          if (hoverPlaceIdRef.current === p.placeId) {
            hoverPlaceIdRef.current = null;
            setHover(null);
          }
        });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          hoverPlaceIdRef.current = null;
          setHover(null);
          onSelectRef.current(p);
        });

        marker.addTo(map);
        markersRef.current.set(p.placeId, marker);
      }

      map.invalidateSize();

      if (points.length === 1) {
        map.setView([points[0]!.lat, points[0]!.lng], 14);
      } else {
        map.fitBounds(bounds.pad(0.28), { maxZoom: 14, animate: true });
      }
    })();

    return () => {
      cancelled = true;
    };
    // intentionally omit focusedPlaceId — highlight is handled below without re-fitting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, points, pointsKey]);

  // Highlight active pin without moving the map (text hover / card hover)
  useEffect(() => {
    if (!mapReady) return;
    let cancelled = false;
    void (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      for (const [placeId, marker] of markersRef.current.entries()) {
        const active = placeId === focusedPlaceId;
        marker.setIcon(
          L.divIcon({
            className: "chat-map-pin",
            html: pinIconHtml(active),
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        );
        marker.setZIndexOffset(active ? 1000 : 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapReady, focusedPlaceId, pointsKey]);

  useEffect(() => {
    if (!focusedPlaceId || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-place-id="${CSS.escape(focusedPlaceId)}"]`,
    );
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [focusedPlaceId]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(map.getZoom() + delta);
  };

  return (
    <aside
      className={`relative flex min-h-0 flex-col overflow-hidden border-l border-slate-200 bg-slate-100 ${className}`}
      aria-label="Map of recommended places"
    >
      <div className="absolute left-3 top-3 z-[500] flex gap-2">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200">
          <Search className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="absolute bottom-24 right-3 z-[500] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => zoomBy(1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md ring-1 ring-slate-200">
          <Layers className="h-4 w-4" aria-hidden />
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          className="absolute inset-0 z-0 h-full w-full [&_.chat-map-pin]:!border-0 [&_.chat-map-pin]:!bg-transparent [&_.leaflet-control-attribution]:!mb-[4.25rem] [&_.leaflet-control-attribution]:!text-[10px]"
        />

        {hover ? (
          <div
            className="pointer-events-none absolute z-[450] w-[min(16.5rem,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-[calc(100%+0.75rem)]"
            style={{ left: hover.x, top: hover.y }}
            role="tooltip"
          >
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-slate-900/5">
              {hover.place.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- proxied Google Places photo
                <img
                  src={hover.place.photoUrl}
                  alt=""
                  className="h-24 w-full object-cover"
                />
              ) : (
                <div className="flex h-16 items-center justify-center bg-slate-100">
                  <MapPin className="h-5 w-5 text-slate-300" aria-hidden />
                </div>
              )}
              <div className="space-y-1 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {hover.place.name}
                    </p>
                    {hover.place.category ? (
                      <p className="truncate text-[0.7rem] text-slate-500">
                        {hover.place.category}
                      </p>
                    ) : null}
                  </div>
                  {hover.place.rating != null ? (
                    <p className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-slate-800">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                      {hover.place.rating.toFixed(1)}
                    </p>
                  ) : null}
                </div>
                <p className="line-clamp-3 text-[0.75rem] leading-5 text-slate-600">
                  {previewSnippet(hover.place)}
                </p>
                <p className="text-[0.65rem] font-medium text-slate-400">Click for full details</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[500] border-t border-slate-200/80 bg-white/95 backdrop-blur-sm">
        {points.length === 0 ? (
          <p className="px-4 py-3 text-xs text-slate-500">
            {places.length > 0
              ? "These places don’t have map coordinates yet."
              : "Place pins appear here when the assistant recommends spots with locations."}
          </p>
        ) : (
          <div
            ref={listRef}
            className="flex gap-2 overflow-x-auto px-3 py-2.5"
            role="list"
            aria-label="Recommended places on map"
          >
            {points.map((p) => {
              const active = p.placeId === focusedPlaceId;
              return (
                <button
                  key={p.placeId}
                  type="button"
                  data-place-id={p.placeId}
                  role="listitem"
                  onClick={() => onSelectPlace(p)}
                  className={`inline-flex max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-left text-xs font-medium transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-800 ring-1 ring-slate-200 hover:bg-slate-200"
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
