import type { ForexRateResponse, ForexTransaction } from "@/app/app/forex/_lib/types";

const RATE_CACHE_KEY = "travel-os-forex-rate-cache";
const TXNS_KEY = "travel-os-forex-transactions";

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

export function loadTransactions(): ForexTransaction[] {
  try {
    const raw = localStorage.getItem(TXNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ForexTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTransactions(rows: ForexTransaction[]) {
  localStorage.setItem(TXNS_KEY, JSON.stringify(rows));
}
