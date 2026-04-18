import { LOCAL_APPS_DATA } from "@/app/app/local-apps/_lib/city-apps-data";
import type { LocalCityApps } from "@/app/app/local-apps/_lib/types";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

const CACHE_PREFIX = "travel-os-local-apps-city";
const USER_RATING_PREFIX = "travel-os-local-apps-user-ratings";

export function normalizeCityFromDestination(destination: string): string {
  return resolveDestination(destination).city.toLowerCase();
}

const CITY_DATA_KEY_OVERRIDES: Record<string, keyof typeof LOCAL_APPS_DATA> = {
  bangkok: "bangkok",
  dubai: "dubai",
  singapore: "singapore",
  bali: "bali",
  london: "london",
};

const COUNTRY_TO_DATA_KEY: Record<string, keyof typeof LOCAL_APPS_DATA> = {
  india: "india",
  japan: "japan",
  thailand: "bangkok",
  "united arab emirates": "dubai",
  uae: "dubai",
  emirates: "dubai",
  singapore: "singapore",
  indonesia: "bali",
  "united kingdom": "london",
  uk: "london",
  britain: "london",
};

const COUNTRY_PLACE_KEYWORDS: Record<string, string[]> = {
  india: [
    "manali",
    "mussoorie",
    "goa",
    "delhi",
    "new delhi",
    "mumbai",
    "bangalore",
    "bengaluru",
    "jaipur",
    "udaipur",
    "rishikesh",
    "shimla",
    "leh",
    "ladakh",
    "agra",
    "varanasi",
    "amritsar",
    "kerala",
    "kochi",
    "munnar",
    "andaman",
    "hyderabad",
    "chennai",
    "kolkata",
    "pune",
    "kashmir",
    "srinagar",
    "darjeeling",
  ],
  japan: [
    "tokyo",
    "osaka",
    "kyoto",
    "sapporo",
    "nara",
    "hakone",
    "hiroshima",
    "fukuoka",
    "okinawa",
    "yokohama",
    "nagoya",
  ],
};

function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesTerm(haystack: string, term: string): boolean {
  return ` ${haystack} `.includes(` ${term} `);
}

function inferCountryFromKeywords(normalized: string): string | null {
  for (const [country, places] of Object.entries(COUNTRY_PLACE_KEYWORDS)) {
    if (places.some((p) => includesTerm(normalized, p))) return country;
  }
  return null;
}

export function resolveCityApps(destination: string): LocalCityApps {
  const intel = resolveDestination(destination);
  const normalized = normalizeText(intel.normalized);
  const city = normalizeText(intel.city);

  const cityDataKey = CITY_DATA_KEY_OVERRIDES[city];
  if (cityDataKey) return LOCAL_APPS_DATA[cityDataKey];

  const resolvedCountry = normalizeText(intel.country);
  const inferredCountry = inferCountryFromKeywords(normalized);
  const countryKey = resolvedCountry !== "unknown" ? resolvedCountry : inferredCountry ?? "";
  const countryDataKey = COUNTRY_TO_DATA_KEY[countryKey];
  if (countryDataKey) return LOCAL_APPS_DATA[countryDataKey];

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
