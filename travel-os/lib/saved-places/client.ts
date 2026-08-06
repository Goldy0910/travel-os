import type { SavedPlace, SavedPlaceInput } from "@/lib/saved-places/types";

export async function fetchSavedPlaces(): Promise<{
  items: SavedPlace[];
  migrationPending?: boolean;
}> {
  try {
    const res = await fetch("/api/saved-places", { method: "GET", cache: "no-store" });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      items?: SavedPlace[];
      migrationPending?: boolean;
    } | null;
    if (!res.ok || !data?.ok) {
      return { items: [], migrationPending: Boolean(data?.migrationPending) };
    }
    return {
      items: Array.isArray(data.items) ? data.items : [],
      migrationPending: Boolean(data.migrationPending),
    };
  } catch {
    return { items: [] };
  }
}

export async function fetchSavedPlaceIds(placeIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(placeIds.map((id) => id.trim()).filter(Boolean))];
  if (!ids.length) return new Set();
  try {
    const res = await fetch(
      `/api/saved-places?ids=${encodeURIComponent(ids.join(","))}`,
      { method: "GET", cache: "no-store" },
    );
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      savedIds?: string[];
    } | null;
    if (!res.ok || !data?.ok) return new Set();
    return new Set(data.savedIds ?? []);
  } catch {
    return new Set();
  }
}

export async function savePlaceClient(
  input: SavedPlaceInput,
): Promise<{ ok: boolean; item?: SavedPlace; migrationPending?: boolean }> {
  try {
    const res = await fetch("/api/saved-places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      item?: SavedPlace;
      migrationPending?: boolean;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, migrationPending: Boolean(data?.migrationPending) };
    }
    return { ok: true, item: data.item, migrationPending: Boolean(data.migrationPending) };
  } catch {
    return { ok: false };
  }
}

export async function unsavePlaceClient(
  placeId: string,
): Promise<{ ok: boolean; migrationPending?: boolean }> {
  const id = placeId.trim();
  if (!id) return { ok: false };
  try {
    const res = await fetch(`/api/saved-places/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      migrationPending?: boolean;
    } | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, migrationPending: Boolean(data?.migrationPending) };
    }
    return { ok: true, migrationPending: Boolean(data.migrationPending) };
  } catch {
    return { ok: false };
  }
}
