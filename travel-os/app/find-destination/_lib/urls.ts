export function toDestinationSlug(name: string, country?: string): string {
  const base = `${name}-${country ?? ""}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "destination";
}

export function createTripHrefForSlug(slug: string, travelPlaceSlug?: string): string {
  const place = encodeURIComponent(travelPlaceSlug || slug);
  return `/app/create-trip?place=${place}`;
}

export function loginThenCreateTripHref(slug: string, travelPlaceSlug?: string): string {
  const next = createTripHrefForSlug(slug, travelPlaceSlug);
  return `/app/login?next=${encodeURIComponent(next)}`;
}

export function loginThenSaveHref(slug: string): string {
  const next = `/app/continue-destination?action=save&slug=${encodeURIComponent(slug)}`;
  return `/app/login?next=${encodeURIComponent(next)}`;
}
