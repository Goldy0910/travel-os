import type { PublicTripShareSnapshot } from "@/lib/trip-share/types";

export function tripSharePath(token: string): string {
  return `/share/${encodeURIComponent(token)}`;
}

export function tripShareUrl(token: string, baseUrl: string): string {
  const origin = baseUrl.replace(/\/$/, "");
  return `${origin}${tripSharePath(token)}`;
}

export function absolutizeShareImage(pathOrUrl: string | undefined, baseUrl: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const origin = baseUrl.replace(/\/$/, "");
  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

export function buildWhatsAppShareUrl(text: string, url: string): string {
  const message = `${text.trim()}\n\n${url.trim()}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildShareMessage(snapshot: PublicTripShareSnapshot): string {
  const lines = [
    `✈️ ${snapshot.destination.name} — ${snapshot.durationDays} days`,
    "",
    ...snapshot.whyItFits.slice(0, 3).map((line) => `• ${line}`),
    "",
    `Budget: ${snapshot.budgetEstimate}`,
    `Plan on TravelTill99`,
  ];
  return lines.join("\n");
}
