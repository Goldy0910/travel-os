import { resolveDestination } from "@/app/app/_lib/destination-intel";

export function inferCountryFromPlace(placeRaw: string): string {
  return resolveDestination(placeRaw).country;
}

export function currencyForPlace(placeRaw: string): string {
  return resolveDestination(placeRaw).currency;
}
