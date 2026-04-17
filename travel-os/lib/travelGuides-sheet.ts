import "server-only";

import {
  getTravelGuidesForPlace,
  normalizePlaceKey,
  resolvePlaceGuideKey,
  travelGuides,
  type TravelGuideVideo,
  type TravelGuidesBundle,
} from "@/lib/travelGuides";
import { unstable_cache } from "next/cache";

type GuideVideoCategory = "places" | "food";
type SheetVideosByPlace = Record<string, Record<GuideVideoCategory, TravelGuideVideo[]>>;
type CsvTarget = { url: string; gid: string | null };

function normalizeSheetEnvUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return "";
  // Allow users to paste values like "<https://...>" in .env.
  if (value.startsWith("<") && value.endsWith(">")) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function buildGoogleCsvTargets(rawUrl: string): CsvTarget[] {
  const clean = normalizeSheetEnvUrl(rawUrl);
  if (!clean) return [];
  try {
    const u = new URL(clean);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // If this is already a CSV export URL, use as-is.
    if (u.searchParams.get("output") === "csv") {
      return [{ url: u.toString(), gid: u.searchParams.get("gid") }];
    }

    // Support regular Google Sheet share/edit URLs.
    if (host.includes("docs.google.com") && path.includes("/spreadsheets/d/")) {
      const m = path.match(/\/spreadsheets\/d\/([^/]+)/);
      const sheetId = m?.[1]?.trim();
      if (!sheetId) return [{ url: clean, gid: null }];
      const gid = u.searchParams.get("gid");
      const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const targets: CsvTarget[] = [];
      if (gid) targets.push({ url: `${base}&gid=${encodeURIComponent(gid)}`, gid });
      targets.push({ url: base, gid: null });
      return targets;
    }
  } catch {
    return [];
  }
  return [{ url: clean, gid: null }];
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function detectCategory(raw: string): GuideVideoCategory | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "places" || v === "place" || v === "sightseeing") return "places";
  if (v === "food" || v === "foods" || v === "eat" || v === "eats") return "food";
  return null;
}

function extractYoutubeId(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] ?? "";
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v") ?? "";
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] ?? "";
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

function resolvePlaceKeyForSheet(place: string, available: string[]): string | null {
  const compact = normalizePlaceKey(place);
  if (!compact) return null;
  if (available.includes(compact)) return compact;
  for (const key of available) {
    if (compact.includes(key) || key.includes(compact)) return key;
  }
  return null;
}

async function loadGuideVideosFromSheet(): Promise<SheetVideosByPlace> {
  const csvUrlRaw = process.env.GOOGLE_SHEETS_GUIDES_CSV_URL?.trim() ?? "";
  if (!csvUrlRaw) return {};

  const targets = buildGoogleCsvTargets(csvUrlRaw);
  if (targets.length === 0) return {};

  let text = "";
  for (const target of targets) {
    const res = await fetch(target.url, { next: { revalidate: 60 * 10 } });
    if (!res.ok) continue;
    const body = await res.text();
    // Skip HTML responses from invalid/unpublished share links.
    if (/^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body)) continue;
    text = body;
    break;
  }
  if (!text) return {};

  const rows = parseCsv(text);
  if (rows.length < 2) return {};

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const out: SheetVideosByPlace = {};

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    const placeRaw = pick(row, ["place", "destination", "location", "city"]);
    const categoryRaw = pick(row, ["category", "type", "section", "tab"]);
    const title = pick(row, ["title", "video_title", "name"]);
    const youtubeRaw = pick(row, ["youtube_id", "video_id", "youtube", "youtube_url", "url", "link"]);
    const category = detectCategory(categoryRaw);
    const youtubeId = extractYoutubeId(youtubeRaw);
    const placeKey = normalizePlaceKey(placeRaw);

    if (!placeKey || !category || !title || !youtubeId) continue;

    if (!out[placeKey]) out[placeKey] = { places: [], food: [] };
    out[placeKey][category].push({ title, youtubeId });
  }

  return out;
}

const getCachedSheetGuides = unstable_cache(loadGuideVideosFromSheet, ["travel-os-sheet-guides-v1"], {
  revalidate: 60 * 10,
});

export async function getTravelGuidesForPlaceScalable(place: string): Promise<TravelGuidesBundle | null> {
  const fallback = getTravelGuidesForPlace(place);
  const sheet = await getCachedSheetGuides();
  const sheetKeys = Object.keys(sheet);
  const sheetKey = resolvePlaceKeyForSheet(place, sheetKeys);

  if (!sheetKey) return fallback;
  const sheetPlaceData = sheet[sheetKey];
  if (!sheetPlaceData) return fallback;

  const baseKey = resolvePlaceGuideKey(place);
  const base =
    (baseKey ? travelGuides[baseKey] : null) ??
    fallback ??
    {
      places: [],
      food: [],
      essentials: { weather: "", language: "", currency: "", fashion: "", tips: [] },
      transport: [],
      money: { atm: "", exchange: "", tips: [] },
      links: [],
    };

  return {
    ...base,
    places: sheetPlaceData.places.length > 0 ? sheetPlaceData.places : base.places,
    food: sheetPlaceData.food.length > 0 ? sheetPlaceData.food : base.food,
  };
}
