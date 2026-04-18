import { ESIM_CITY_DATA } from "@/app/app/esim/_lib/esim-data";
import type { CarrierPlan, DurationDays, SimConnectivityBundle, UsageType } from "@/app/app/esim/_lib/types";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

const CACHE_PREFIX = "travel-os-esim-bundle";

const CITY_TO_BUNDLE_KEY: Record<string, keyof typeof ESIM_CITY_DATA> = {
  bangkok: "bangkok",
  dubai: "dubai",
  singapore: "singapore",
};

const COUNTRY_TO_BUNDLE_KEY: Record<string, keyof typeof ESIM_CITY_DATA> = {
  india: "india",
  japan: "japan",
  thailand: "bangkok",
  singapore: "singapore",
  "united arab emirates": "dubai",
  uae: "dubai",
  emirates: "dubai",
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

export function resolveBundleFromDestination(destination: string): SimConnectivityBundle {
  const intel = resolveDestination(destination);
  const normalized = normalizeText(intel.normalized);
  const city = normalizeText(intel.city);
  const country = normalizeText(intel.country);

  const cityKey = CITY_TO_BUNDLE_KEY[city];
  if (cityKey) return ESIM_CITY_DATA[cityKey];

  const countryFromPlace = inferCountryFromKeywords(normalized);
  const effectiveCountry = country !== "unknown" ? country : countryFromPlace ?? "";
  const countryKey = COUNTRY_TO_BUNDLE_KEY[effectiveCountry];
  if (countryKey) return ESIM_CITY_DATA[countryKey];

  return ESIM_CITY_DATA.global;
}

export function saveBundleCache(cacheKey: string, value: SimConnectivityBundle) {
  localStorage.setItem(`${CACHE_PREFIX}:${cacheKey}`, JSON.stringify(value));
}

export function loadBundleCache(cacheKey: string): SimConnectivityBundle | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${cacheKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as SimConnectivityBundle;
  } catch {
    return null;
  }
}

function usageWeight(usage: UsageType): number {
  if (usage === "Heavy") return 3;
  if (usage === "Medium") return 2;
  return 1;
}

export function recommendPlan(input: {
  bundle: SimConnectivityBundle;
  duration: DurationDays;
  usage: UsageType;
}): { plan: CarrierPlan; carrier: string; estimatedCostInr: number } | null {
  const scoreTarget = input.duration * usageWeight(input.usage);
  let best:
    | { plan: CarrierPlan; carrier: string; diff: number; scorePrice: number }
    | null = null;

  for (const carrier of input.bundle.topCarriers) {
    for (const plan of carrier.plans) {
      const planScore = plan.validityDays * 2;
      const diff = Math.abs(planScore - scoreTarget);
      const scorePrice = plan.priceInr;
      if (!best || diff < best.diff || (diff === best.diff && scorePrice < best.scorePrice)) {
        best = { plan, carrier: carrier.carrier, diff, scorePrice };
      }
    }
  }
  if (!best) return null;
  return {
    plan: best.plan,
    carrier: best.carrier,
    estimatedCostInr: best.plan.priceInr,
  };
}

export function savingsLabel(airportPriceInr: number, cityPriceInr: number): string {
  const savings = Math.max(0, airportPriceInr - cityPriceInr);
  if (savings === 0) return "No price difference";
  return `Save INR ${savings} by buying in city`;
}
