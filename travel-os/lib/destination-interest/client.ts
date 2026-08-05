import type { DestinationInterestEventType } from "@/lib/destination-interest/constants";
import type { DestinationInterestSnapshot } from "@/lib/destination-interest/types";

const inflightBatches = new Map<string, Promise<Map<string, DestinationInterestSnapshot>>>();
const clientCache = new Map<string, { expiresAt: number; value: DestinationInterestSnapshot }>();
const CLIENT_TTL_MS = 45_000;

function cacheGet(id: string): DestinationInterestSnapshot | null {
  const hit = clientCache.get(id);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    clientCache.delete(id);
    return null;
  }
  return hit.value;
}

function cacheSet(snapshot: DestinationInterestSnapshot) {
  clientCache.set(snapshot.destinationId, {
    value: snapshot,
    expiresAt: Date.now() + CLIENT_TTL_MS,
  });
}

/** Fire-and-forget client track. Never throws. */
export function trackDestinationInterestClient(
  destinationId: string,
  eventType: DestinationInterestEventType,
): void {
  const id = destinationId.trim();
  if (!id) return;
  try {
    void fetch("/api/analytics/destination-interest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId: id, eventType }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}

export function invalidateClientInterestCache(ids?: string[]) {
  if (!ids?.length) {
    clientCache.clear();
    return;
  }
  for (const id of ids) clientCache.delete(id.trim().toLowerCase());
}

export async function fetchDestinationInterestBatch(
  destinationIds: string[],
  options?: { bypassCache?: boolean },
): Promise<Map<string, DestinationInterestSnapshot>> {
  const ids = [...new Set(destinationIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
  const out = new Map<string, DestinationInterestSnapshot>();
  if (!ids.length) return out;

  if (options?.bypassCache) invalidateClientInterestCache(ids);

  const missing: string[] = [];
  for (const id of ids) {
    const cached = cacheGet(id);
    if (cached) out.set(id, cached);
    else missing.push(id);
  }
  if (!missing.length) return out;

  const batchKey = missing.slice().sort().join(",");
  let pending = inflightBatches.get(batchKey);
  if (!pending) {
    pending = (async () => {
      const map = new Map<string, DestinationInterestSnapshot>();
      try {
        const res = await fetch(
          `/api/destinations/interest?ids=${encodeURIComponent(missing.join(","))}`,
          { method: "GET", cache: "no-store" },
        );
        if (!res.ok) return map;
        const data = (await res.json().catch(() => null)) as
          | { items?: DestinationInterestSnapshot[] }
          | null;
        for (const item of data?.items ?? []) {
          if (!item?.destinationId) continue;
          cacheSet(item);
          map.set(item.destinationId, item);
        }
      } catch {
        return map;
      }
      return map;
    })();
    inflightBatches.set(batchKey, pending);
    void pending.finally(() => inflightBatches.delete(batchKey));
  }

  const fetched = await pending;
  for (const [id, snapshot] of fetched) out.set(id, snapshot);
  return out;
}
