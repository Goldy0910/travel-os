import { INTEREST_READ_CACHE_MAX, INTEREST_READ_CACHE_TTL_MS } from "@/lib/destination-interest/constants";
import type { DestinationInterestSnapshot } from "@/lib/destination-interest/types";

type CacheEntry = {
  expiresAt: number;
  value: DestinationInterestSnapshot;
};

const globalStore = globalThis as typeof globalThis & {
  __travelOsDestinationInterestCache?: Map<string, CacheEntry>;
};

function store(): Map<string, CacheEntry> {
  if (!globalStore.__travelOsDestinationInterestCache) {
    globalStore.__travelOsDestinationInterestCache = new Map();
  }
  return globalStore.__travelOsDestinationInterestCache;
}

export function interestCacheKey(destinationId: string, year: number, month: number): string {
  return `${destinationId}:${year}:${month}`;
}

export function readInterestCache(key: string): DestinationInterestSnapshot | null {
  const entry = store().get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store().delete(key);
    return null;
  }
  return entry.value;
}

export function writeInterestCache(key: string, value: DestinationInterestSnapshot) {
  const cache = store();
  if (cache.size >= INTEREST_READ_CACHE_MAX) {
    const first = cache.keys().next().value;
    if (typeof first === "string") cache.delete(first);
  }
  cache.set(key, { value, expiresAt: Date.now() + INTEREST_READ_CACHE_TTL_MS });
}

export function invalidateInterestCache(destinationId: string, year: number, month: number) {
  store().delete(interestCacheKey(destinationId, year, month));
}
