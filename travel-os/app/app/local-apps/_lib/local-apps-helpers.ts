import { LOCAL_APPS_DATA } from "@/app/app/local-apps/_lib/city-apps-data";
import type { LocalCityApps } from "@/app/app/local-apps/_lib/types";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

const CACHE_PREFIX = "travel-os-local-apps-city";
const USER_RATING_PREFIX = "travel-os-local-apps-user-ratings";

export function normalizeCityFromDestination(destination: string): string {
  return resolveDestination(destination).city.toLowerCase();
}

export function resolveCityApps(destination: string): LocalCityApps {
  const intel = resolveDestination(destination);
  const raw = intel.normalized;
  const city = intel.city.toLowerCase();
  if (LOCAL_APPS_DATA[city]) return LOCAL_APPS_DATA[city];

  // Country/city inference based on selected destination string.
  if (raw.includes("thailand") || city === "bangkok") return LOCAL_APPS_DATA.bangkok;
  if (raw.includes("uae") || raw.includes("united arab emirates") || city === "dubai") {
    return LOCAL_APPS_DATA.dubai;
  }
  if (raw.includes("singapore") || city === "singapore") return LOCAL_APPS_DATA.singapore;
  if (raw.includes("indonesia") || city === "bali") return LOCAL_APPS_DATA.bali;
  if (raw.includes("uk") || raw.includes("united kingdom") || city === "london") {
    return LOCAL_APPS_DATA.london;
  }
  if (
    raw.includes("india") ||
    raw.includes("mussoorie") ||
    raw.includes("delhi") ||
    raw.includes("mumbai") ||
    raw.includes("bangalore") ||
    raw.includes("goa")
  ) {
    return LOCAL_APPS_DATA.india;
  }
  return LOCAL_APPS_DATA.global;
}

export function loadCityCache(cityKey: string): LocalCityApps | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${cityKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as LocalCityApps;
  } catch {
    return null;
  }
}

export function saveCityCache(cityKey: string, data: LocalCityApps) {
  localStorage.setItem(`${CACHE_PREFIX}:${cityKey}`, JSON.stringify(data));
}

export function loadUserRatings(): Record<string, number> {
  try {
    const raw = localStorage.getItem(USER_RATING_PREFIX);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function saveUserRatings(next: Record<string, number>) {
  localStorage.setItem(USER_RATING_PREFIX, JSON.stringify(next));
}

export function tripIsActive(startDate: string, endDate: string): boolean {
  const now = Date.now();
  const s = new Date(`${startDate}T00:00:00`).getTime();
  const e = new Date(`${endDate}T23:59:59`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  return now >= s && now <= e;
}
