import { resolveDestination } from "@/app/app/_lib/destination-intel";

const COUNTRY_PLACE_KEYWORDS: Record<string, string[]> = {
  India: [
    "india",
    "bharat",
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
  Japan: [
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
  Thailand: ["bangkok", "phuket", "chiang mai", "krabi", "pattaya"],
  "United Arab Emirates": ["dubai", "abu dhabi", "sharjah"],
  Singapore: ["singapore"],
  Indonesia: ["bali", "jakarta", "ubud"],
  "United Kingdom": ["london", "manchester", "edinburgh"],
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  India: "INR",
  Japan: "JPY",
  Thailand: "THB",
  "United Arab Emirates": "AED",
  Singapore: "SGD",
  Indonesia: "IDR",
  "United Kingdom": "GBP",
};

function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesTerm(haystack: string, term: string): boolean {
  return ` ${haystack} `.includes(` ${term} `);
}

function inferCountryByKeywords(placeRaw: string): string | null {
  const normalized = normalizeText(placeRaw);
  if (!normalized) return null;
  for (const [country, places] of Object.entries(COUNTRY_PLACE_KEYWORDS)) {
    if (places.some((p) => includesTerm(normalized, p))) return country;
  }
  return null;
}

export function inferCountryFromPlace(placeRaw: string): string {
  const intelCountry = resolveDestination(placeRaw).country;
  if (intelCountry && intelCountry !== "Unknown") return intelCountry;
  return inferCountryByKeywords(placeRaw) ?? "Unknown";
}

export function currencyForPlace(placeRaw: string): string {
  const country = inferCountryFromPlace(placeRaw);
  if (country !== "Unknown" && COUNTRY_TO_CURRENCY[country]) {
    return COUNTRY_TO_CURRENCY[country];
  }

  const intel = resolveDestination(placeRaw);
  if (intel.country !== "Unknown" && intel.currency) {
    return intel.currency;
  }

  return "USD";
}
