type CountryProfile = {
  name: string;
  code: string;
  currency: string;
  language: string;
  aliases?: string[];
};

type CityProfile = {
  city: string;
  country: string;
  aliases?: string[];
};

const COUNTRY_PROFILES: CountryProfile[] = [
  { name: "India", code: "IN", currency: "INR", language: "Hindi", aliases: ["bharat"] },
  { name: "Japan", code: "JP", currency: "JPY", language: "Japanese" },
  { name: "Thailand", code: "TH", currency: "THB", language: "Thai" },
  {
    name: "United Arab Emirates",
    code: "AE",
    currency: "AED",
    language: "Arabic",
    aliases: ["uae", "emirates"],
  },
  { name: "Singapore", code: "SG", currency: "SGD", language: "English" },
  { name: "Indonesia", code: "ID", currency: "IDR", language: "Indonesian" },
  { name: "France", code: "FR", currency: "EUR", language: "French" },
  { name: "United Kingdom", code: "GB", currency: "GBP", language: "English", aliases: ["uk", "britain"] },
  { name: "Italy", code: "IT", currency: "EUR", language: "Italian" },
  { name: "Spain", code: "ES", currency: "EUR", language: "Spanish" },
  { name: "Germany", code: "DE", currency: "EUR", language: "German" },
  { name: "Switzerland", code: "CH", currency: "CHF", language: "German" },
  { name: "United States", code: "US", currency: "USD", language: "English", aliases: ["usa", "us"] },
  { name: "Canada", code: "CA", currency: "CAD", language: "English" },
  { name: "New Zealand", code: "NZ", currency: "NZD", language: "English" },
  { name: "Greece", code: "GR", currency: "EUR", language: "Greek" },
  { name: "Australia", code: "AU", currency: "AUD", language: "English" },
  { name: "Maldives", code: "MV", currency: "MVR", language: "Dhivehi" },
  { name: "Nepal", code: "NP", currency: "NPR", language: "Nepali" },
  { name: "Sri Lanka", code: "LK", currency: "LKR", language: "Sinhala" },
  { name: "Vietnam", code: "VN", currency: "VND", language: "Vietnamese" },
  { name: "Malaysia", code: "MY", currency: "MYR", language: "Malay" },
  { name: "Portugal", code: "PT", currency: "EUR", language: "Portuguese" },
  { name: "Netherlands", code: "NL", currency: "EUR", language: "Dutch" },
  { name: "Turkey", code: "TR", currency: "TRY", language: "Turkish" },
];

const CITY_PROFILES: CityProfile[] = [
  { city: "Tokyo", country: "Japan", aliases: ["osaka", "kyoto", "sapporo"] },
  { city: "Bangkok", country: "Thailand", aliases: ["phuket", "chiang mai", "krabi"] },
  { city: "Dubai", country: "United Arab Emirates", aliases: ["abu dhabi", "sharjah"] },
  { city: "Singapore", country: "Singapore" },
  { city: "Bali", country: "Indonesia", aliases: ["jakarta"] },
  { city: "Paris", country: "France", aliases: ["lyon", "marseille"] },
  { city: "London", country: "United Kingdom" },
  { city: "Rome", country: "Italy", aliases: ["milan", "florence", "venice"] },
  { city: "Barcelona", country: "Spain", aliases: ["madrid", "valencia"] },
  { city: "New York", country: "United States", aliases: ["los angeles", "san francisco"] },
  { city: "Toronto", country: "Canada", aliases: ["vancouver"] },
  { city: "Sydney", country: "Australia", aliases: ["melbourne"] },
  { city: "Berlin", country: "Germany", aliases: ["munich", "frankfurt"] },
  { city: "Zurich", country: "Switzerland", aliases: ["geneva"] },
  { city: "Colombo", country: "Sri Lanka" },
  { city: "Mussoorie", country: "India", aliases: ["manali", "goa", "delhi", "mumbai", "bangalore"] },
];

function normalize(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s,-]/gu, " ")
    .replace(/\s+/g, " ");
}

function includesTerm(haystack: string, term: string): boolean {
  return ` ${haystack} `.includes(` ${term} `);
}

function titleCase(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type DestinationIntel = {
  raw: string;
  normalized: string;
  city: string;
  country: string;
  countryCode: string;
  currency: string;
  language: string;
  searchQuery: string;
  cacheKey: string;
};

export function resolveDestination(input: string): DestinationIntel {
  const raw = input.trim();
  const normalized = normalize(raw);
  const firstPart = raw.split(",")[0]?.trim() || "";
  const firstPartNorm = normalize(firstPart);

  let city = firstPart || "Unknown";
  let country = "";

  for (const profile of CITY_PROFILES) {
    if (includesTerm(normalized, normalize(profile.city))) {
      city = profile.city;
      country = profile.country;
      break;
    }
    const aliases = profile.aliases ?? [];
    const aliasMatch = aliases.some((a) => includesTerm(normalized, normalize(a)));
    if (aliasMatch) {
      city = profile.city;
      country = profile.country;
      break;
    }
  }

  if (!country) {
    for (const profile of COUNTRY_PROFILES) {
      const direct = includesTerm(normalized, normalize(profile.name));
      const aliasMatch = (profile.aliases ?? []).some((a) => includesTerm(normalized, normalize(a)));
      if (direct || aliasMatch) {
        country = profile.name;
        break;
      }
    }
  }

  if (!country && firstPartNorm) {
    for (const profile of COUNTRY_PROFILES) {
      if (normalize(profile.name) === firstPartNorm) {
        country = profile.name;
        break;
      }
    }
  }

  const countryProfile =
    COUNTRY_PROFILES.find((c) => c.name === country) ??
    COUNTRY_PROFILES.find((c) => normalize(c.name) === normalize(country));

  return {
    raw,
    normalized,
    city: titleCase(city),
    country: countryProfile?.name || titleCase(country || "Unknown"),
    countryCode: countryProfile?.code || "",
    currency: countryProfile?.currency || "USD",
    language: countryProfile?.language || "English",
    searchQuery: [titleCase(city), countryProfile?.name || titleCase(country)].filter(Boolean).join(", "),
    cacheKey: `${normalize(city || firstPart || "unknown")}|${normalize(countryProfile?.name || country || "unknown")}`,
  };
}
