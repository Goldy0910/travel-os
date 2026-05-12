import type { ForexRateResponse } from "@/app/app/forex/_lib/types";

const RATE_CACHE_KEY = "travel-os-forex-rate-cache";

export function loadRateCache(currency: string): ForexRateResponse | null {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, ForexRateResponse>;
    const key = currency.trim().toUpperCase();
    return all[key] ?? null;
  } catch {
    return null;
  }
}

export function saveRateCache(currency: string, value: ForexRateResponse) {
  try {
    const raw = localStorage.getItem(RATE_CACHE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, ForexRateResponse>) : {};
    all[currency.trim().toUpperCase()] = value;
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(all));
  } catch {
    // ignore cache writes
  }
}
