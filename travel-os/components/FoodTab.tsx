"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const CUISINES = [
  "Any",
  "Italian",
  "Chinese",
  "Indian",
  "Japanese",
  "Mexican",
  "Thai",
  "Mediterranean",
  "American",
  "Local",
];
const DIETARY = ["None", "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free"];
const BUDGETS = [
  { label: "Any", value: "" },
  { label: "₹ Budget", value: "budget" },
  { label: "₹₹ Mid", value: "mid" },
  { label: "₹₹₹ Upscale", value: "upscale" },
];
const VOTES = ["yes", "maybe", "no"] as const;
const VOTE_ICONS: Record<string, string> = { yes: "✓", maybe: "?", no: "✕" };
const VOTE_COLORS: Record<string, string> = {
  yes: "bg-green-100 text-green-700 border-green-200",
  maybe: "bg-yellow-100 text-yellow-700 border-yellow-200",
  no: "bg-red-100 text-red-600 border-red-200",
};

/** Stable toast id so repeated searches replace the previous error instead of stacking. */
const PLACES_SEARCH_TOAST_ID = "food-places-search";

type Restaurant = {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  user_rating_count: number;
  price_level: string | null;
  summary: string;
  maps_url: string;
  is_open: boolean | null;
  photo_name: string | null;
  /** Classic Places API photo reference (use with maps.googleapis.com/place/photo). */
  photo_legacy_ref?: string | null;
  types: string[];
};

type SavedRestaurantRow = {
  place_id: string;
  name: string;
  address?: string | null;
  rating?: number | null;
  maps_url?: string | null;
};

type MenuItem = {
  original: string;
  translated: string;
  price: string | null;
  category: string;
};

type Props = {
  tripId: string;
  destination: string;
};

function toRestaurantForSave(r: Restaurant | SavedRestaurantRow): Restaurant {
  if ("user_rating_count" in r) return r as Restaurant;
  return {
    place_id: r.place_id,
    name: r.name,
    address: r.address ?? "",
    rating: r.rating ?? null,
    user_rating_count: 0,
    price_level: null,
    summary: "",
    maps_url: r.maps_url ?? "",
    is_open: null,
    photo_name: null,
    photo_legacy_ref: null,
    types: [],
  };
}

export default function FoodTab({ tripId, destination }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"discover" | "saved" | "translate">("discover");
  const [cuisine, setCuisine] = useState("Any");
  const [dietary, setDietary] = useState("None");
  const [budget, setBudget] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [savedList, setSavedList] = useState<SavedRestaurantRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const menuGalleryInputRef = useRef<HTMLInputElement>(null);
  const menuCameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const loadSaved = useCallback(async () => {
    const { data, error } = await supabase
      .from("trip_saved_restaurants")
      .select("place_id,name,address,rating,maps_url")
      .eq("trip_id", tripId);
    if (error) {
      if (error.code === "PGRST205") {
        toast.error("Food tables missing. Apply migration 20260421_trip_food_restaurants.sql.");
      }
      return;
    }
    if (data) {
      const rows = data as SavedRestaurantRow[];
      setSaved(new Set(rows.map((r) => String(r.place_id))));
      setSavedList(rows);
    }
  }, [supabase, tripId]);

  const loadVotes = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("trip_restaurant_votes")
      .select("place_id,vote")
      .eq("trip_id", tripId)
      .eq("user_id", userId);
    if (error) return;
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((v: { place_id: string; vote: string }) => {
        map[v.place_id] = v.vote;
      });
      setVotes(map);
    }
  }, [supabase, tripId, userId]);

  useEffect(() => {
    if (userId) {
      void loadSaved();
      void loadVotes();
    }
  }, [userId, loadSaved, loadVotes]);

  async function searchRestaurants() {
    const dest = destination.trim();
    if (!dest) {
      toast.error("Set a trip destination to search restaurants.");
      return;
    }
    toast.dismiss(PLACES_SEARCH_TOAST_ID);
    setIsSearching(true);
    setSearched(true);
    setRestaurants([]);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 0,
            });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          /* optional bias for search */
        }
      }

      const res = await fetch("/api/places-search", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          destination: dest,
          cuisine: cuisine === "Any" ? "" : cuisine,
          dietary: dietary === "None" ? "" : dietary,
          budget,
          ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
        }),
      });
      const data = (await res.json()) as {
        places?: Restaurant[];
        error?: string;
        hint?: string;
        notice?: string;
      };
      if (!res.ok) {
        const msg = [data.error, data.hint].filter(Boolean).join(" ");
        toast.error(
          msg ||
            "Restaurant search failed. Set GOOGLE_MAPS_API_KEY or GOOGLE_PLACES_API_KEY in .env (server key: IP restriction or none—not HTTP referrers only) and enable Places API (New).",
          { id: PLACES_SEARCH_TOAST_ID, duration: 12_000 },
        );
        setRestaurants([]);
        return;
      }
      toast.dismiss(PLACES_SEARCH_TOAST_ID);
      setRestaurants(data.places || []);
      if (data.notice) toast.message(data.notice, { duration: 6000 });
    } finally {
      setIsSearching(false);
    }
  }

  async function toggleSave(r: Restaurant | SavedRestaurantRow) {
    const row = toRestaurantForSave(r);
    if (!userId) {
      toast.error("Sign in to save restaurants.");
      return;
    }
    if (saved.has(row.place_id)) {
      const { error } = await supabase
        .from("trip_saved_restaurants")
        .delete()
        .eq("trip_id", tripId)
        .eq("place_id", row.place_id);
      if (error) {
        toast.error(error.message || "Could not remove.");
        return;
      }
      setSaved((prev) => {
        const s = new Set(prev);
        s.delete(row.place_id);
        return s;
      });
      setSavedList((prev) => prev.filter((x) => x.place_id !== row.place_id));
    } else {
      const { data, error } = await supabase
        .from("trip_saved_restaurants")
        .insert({
          trip_id: tripId,
          saved_by: userId,
          place_id: row.place_id,
          name: row.name,
          address: row.address,
          rating: row.rating,
          maps_url: row.maps_url,
        })
        .select("place_id,name,address,rating,maps_url")
        .single();
      if (error) {
        toast.error(error.message || "Could not save.");
        return;
      }
      setSaved((prev) => new Set([...prev, row.place_id]));
      if (data) setSavedList((prev) => [...prev, data as SavedRestaurantRow]);
    }
  }

  async function castVote(place_id: string, vote: string) {
    if (!userId) {
      toast.error("Sign in to vote.");
      return;
    }
    const existing = votes[place_id];
    if (existing === vote) {
      const { error } = await supabase
        .from("trip_restaurant_votes")
        .delete()
        .eq("trip_id", tripId)
        .eq("place_id", place_id)
        .eq("user_id", userId);
      if (error) {
        toast.error(error.message || "Could not clear vote.");
        return;
      }
      setVotes((prev) => {
        const v = { ...prev };
        delete v[place_id];
        return v;
      });
    } else {
      const { error } = await supabase.from("trip_restaurant_votes").upsert(
        {
          trip_id: tripId,
          place_id,
          user_id: userId,
          vote,
        },
        { onConflict: "trip_id,place_id,user_id" },
      );
      if (error) {
        toast.error(error.message || "Could not save vote.");
        return;
      }
      setVotes((prev) => ({ ...prev, [place_id]: vote }));
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsTranslating(true);
    setMenuItems([]);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const m = /^data:([^;]+);base64,(.+)$/.exec(result);
        const mimeType = m?.[1]?.trim() || file.type || "image/jpeg";
        const base64 = m?.[2]?.trim() || result.split(",")[1] || "";
        if (!base64) {
          toast.error("Could not read image.");
          setIsTranslating(false);
          return;
        }
        const res = await fetch("/api/translate-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
            targetLanguage: "English",
          }),
        });
        const data = (await res.json()) as { items?: MenuItem[]; error?: string };
        if (!res.ok) {
          toast.error(data.error || "Translation failed.");
          setMenuItems([]);
          return;
        }
        setMenuItems(data.items || []);
        if ((data.items?.length ?? 0) === 0) {
          toast.message("No menu items detected. Try a clearer photo.");
        }
      } finally {
        setIsTranslating(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function getPriceLabel(level: string | null) {
    if (level == null) return "";
    const map: Record<string, string> = {
      PRICE_LEVEL_FREE: "",
      PRICE_LEVEL_INEXPENSIVE: "₹",
      PRICE_LEVEL_MODERATE: "₹₹",
      PRICE_LEVEL_EXPENSIVE: "₹₹₹",
      PRICE_LEVEL_VERY_EXPENSIVE: "₹₹₹₹",
    };
    if (map[level]) return map[level];
    const n = Number(level);
    if (Number.isFinite(n) && n >= 0 && n <= 4) {
      return ["", "₹", "₹₹", "₹₹₹", "₹₹₹₹"][n] ?? "";
    }
    return "";
  }

  return (
    <div className="flex flex-col gap-4 px-0 py-1 pb-8">
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {(["discover", "saved", "translate"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`min-h-11 flex-1 touch-manipulation rounded-lg py-2 text-xs font-medium transition-all ${
              view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {v === "discover" ? "🔍 Discover" : v === "saved" ? "❤️ Saved" : "📷 Menu"}
          </button>
        ))}
      </div>

      {view === "discover" && (
        <div className="flex flex-col gap-3">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {CUISINES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCuisine(c)}
                className={`shrink-0 touch-manipulation rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                  cuisine === c
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <select
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {DIETARY.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              {BUDGETS.map((b) => (
                <option key={b.value || "any"} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void searchRestaurants()}
            disabled={isSearching}
            className="min-h-12 w-full touch-manipulation rounded-xl bg-indigo-600 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSearching ? "Searching…" : `🍽️ Find restaurants in ${destination.trim() || "…"}`}
          </button>

          {restaurants.map((r) => {
            const photoSrc = r.photo_name
              ? `/api/place-photo?name=${encodeURIComponent(r.photo_name)}&maxH=200`
              : r.photo_legacy_ref
                ? `/api/place-photo?ref=${encodeURIComponent(r.photo_legacy_ref)}&maxH=200`
                : null;
            return (
            <div
              key={r.place_id}
              className="overflow-hidden rounded-xl border border-gray-100 bg-white"
            >
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                {photoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- proxied via /api/place-photo
                  <img
                    src={photoSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl" aria-hidden>
                    🍽️
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{r.address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggleSave(r)}
                    className="flex-shrink-0 touch-manipulation text-lg"
                    aria-label={saved.has(r.place_id) ? "Remove from saved" : "Save restaurant"}
                  >
                    {saved.has(r.place_id) ? "❤️" : "🤍"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {r.rating != null && (
                    <span className="rounded-full border border-yellow-100 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700">
                      ⭐ {r.rating} ({r.user_rating_count})
                    </span>
                  )}
                  {r.price_level && (
                    <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-xs text-gray-600">
                      {getPriceLabel(r.price_level)}
                    </span>
                  )}
                  {r.is_open === true && (
                    <span className="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                      Open now
                    </span>
                  )}
                  {r.is_open === false && (
                    <span className="rounded-full border border-red-100 bg-red-50 px-2 py-0.5 text-xs text-red-600">
                      Closed
                    </span>
                  )}
                </div>

                {r.summary ? (
                  <p className="text-xs leading-relaxed text-gray-500">{r.summary}</p>
                ) : null}

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Group vote:</span>
                  {VOTES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => void castVote(r.place_id, v)}
                      className={`touch-manipulation rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                        votes[r.place_id] === v
                          ? VOTE_COLORS[v]
                          : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {VOTE_ICONS[v]}
                    </button>
                  ))}
                </div>

                <a
                  href={r.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block min-h-11 w-full touch-manipulation rounded-lg border border-gray-200 py-2.5 text-center text-xs font-medium text-gray-700"
                >
                  🗺️ Get directions
                </a>
              </div>
            </div>
            );
          })}

          {searched && !isSearching && restaurants.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              <p className="mb-2 text-2xl">🍽️</p>
              <p>No restaurants found. Try changing the filters.</p>
            </div>
          )}

          {!searched && (
            <div className="py-10 text-center text-sm text-gray-400">
              <p className="mb-2 text-2xl">🍜</p>
              <p>Set your preferences above and search.</p>
            </div>
          )}
        </div>
      )}

      {view === "saved" && (
        <div className="flex flex-col gap-3">
          {savedList.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">
              <p className="mb-2 text-2xl">🤍</p>
              <p>No saved restaurants yet. Discover and tap the heart icon.</p>
            </div>
          ) : (
            savedList.map((r) => (
              <div
                key={r.place_id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{r.address}</p>
                  {r.rating != null && (
                    <p className="mt-1 text-xs text-yellow-600">⭐ {r.rating}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <a
                    href={r.maps_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600"
                  >
                    🗺️ Directions
                  </a>
                  <button
                    type="button"
                    onClick={() => void toggleSave(r)}
                    className="touch-manipulation px-2 text-xs text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {view === "translate" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 text-center">
            <p className="text-2xl" aria-hidden>
              📷
            </p>
            <p className="text-sm font-medium text-gray-800">Take a photo of any menu</p>
            <p className="text-xs text-gray-500">
              AI reads and translates it to English (set GEMINI_API_KEY on the server).
            </p>
            <input
              ref={menuGalleryInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              aria-hidden
            />
            <input
              ref={menuCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
              aria-hidden
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => menuGalleryInputRef.current?.click()}
                disabled={isTranslating}
                className="min-h-12 touch-manipulation rounded-xl border-2 border-indigo-200 bg-white py-3 text-xs font-semibold text-indigo-800 disabled:opacity-50 sm:text-sm"
              >
                🖼️ Gallery
              </button>
              <button
                type="button"
                onClick={() => menuCameraInputRef.current?.click()}
                disabled={isTranslating}
                className="min-h-12 touch-manipulation rounded-xl bg-indigo-600 py-3 text-xs font-semibold text-white disabled:opacity-50 sm:text-sm"
              >
                {isTranslating ? "Translating…" : "📷 Camera"}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">
              Gallery: choose a saved photo. Camera: take a new picture.
            </p>
          </div>

          {menuItems.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Translated Menu ({menuItems.length} items)
                </span>
              </div>
              {menuItems.map((item, i) => (
                <div key={i} className="border-b border-gray-50 px-4 py-3 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{item.translated}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{item.original}</p>
                      {item.category ? (
                        <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                    {item.price ? (
                      <span className="shrink-0 text-sm font-medium text-gray-700">{item.price}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
