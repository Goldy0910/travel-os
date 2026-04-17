import { COUNTRY_OPTIONS, findCountryByName, normalizeCountryName } from "./countries";
import { resolveDestination } from "@/app/app/_lib/destination-intel";

export function flagFromCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌍";
  const points = [...upper].map((ch) => 127397 + ch.charCodeAt(0));
  return String.fromCodePoint(...points);
}

export function flagFromCountryName(countryName: string): string {
  const country = findCountryByName(countryName);
  return country ? flagFromCode(country.code) : "🌍";
}

export function inferCountryFromDestination(destinationRaw: string): string {
  const fromResolver = resolveDestination(destinationRaw).country;
  if (fromResolver && fromResolver !== "Unknown") return fromResolver;

  const destination = normalizeCountryName(destinationRaw);
  if (!destination) return "Unknown";
  const direct = COUNTRY_OPTIONS.find((country) => destination.includes(normalizeCountryName(country.name)));
  if (direct) return direct.name;
  const firstPart = destinationRaw.split(",")[0]?.trim();
  return firstPart && firstPart.length > 0 ? firstPart : "Unknown";
}
