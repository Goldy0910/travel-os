import { headers } from "next/headers";
import {
  CANONICAL_PUBLIC_ORIGIN,
  isBrandPublicOrigin,
  isEphemeralPublicOrigin,
  normalizePublicOrigin,
  trimOrigin,
} from "@/lib/public-site-url-shared";

export {
  CANONICAL_PUBLIC_ORIGIN,
  ensureBrandShareUrl,
  isBrandPublicOrigin,
  isEphemeralPublicOrigin,
  normalizePublicOrigin,
} from "@/lib/public-site-url-shared";

/**
 * Public origin for invite links, WhatsApp text, OG URLs, etc.
 *
 * Production always uses https://traveltill99.com so Copy link never hands out
 * stale Vercel / old-domain URLs from env.
 *
 * Preview / local keep request host or VERCEL_URL so deploys stay testable.
 */

function explicitSiteUrl(): string | undefined {
  return (
    trimOrigin(process.env.NEXT_PUBLIC_APP_URL) ??
    trimOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  );
}

function vercelSiteUrl(): string | undefined {
  const vercel = trimOrigin(process.env.VERCEL_URL);
  if (!vercel) return undefined;
  if (vercel.startsWith("http://") || vercel.startsWith("https://")) {
    return vercel;
  }
  return `https://${vercel}`;
}

function isVercelProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/** First non-empty segment from comma-separated forwarded headers. */
function firstForwarded(value: string | null): string | undefined {
  const part = value?.split(",")[0]?.trim();
  return part || undefined;
}

function originFromIncomingHeaders(h: Headers): string | undefined {
  const host =
    firstForwarded(h.get("x-forwarded-host")) ?? h.get("host")?.trim();
  if (!host) return undefined;

  const forwardedProto = firstForwarded(h.get("x-forwarded-proto"));
  const proto =
    forwardedProto ??
    (host.startsWith("localhost") ||
    host.startsWith("127.") ||
    host.includes(".local")
      ? "http"
      : "https");

  return `${proto}://${host}`.replace(/\/$/, "");
}

export function getPublicSiteUrl(): string {
  if (isVercelProduction()) {
    return CANONICAL_PUBLIC_ORIGIN;
  }

  const explicit = explicitSiteUrl();
  if (explicit && isBrandPublicOrigin(explicit)) {
    return normalizePublicOrigin(explicit);
  }
  if (explicit && !isEphemeralPublicOrigin(explicit)) {
    return normalizePublicOrigin(explicit);
  }

  return explicit ?? vercelSiteUrl() ?? "http://localhost:3000";
}

export async function getResolvedPublicSiteUrl(): Promise<string> {
  if (isVercelProduction()) {
    return CANONICAL_PUBLIC_ORIGIN;
  }

  try {
    const h = await headers();
    const fromRequest = originFromIncomingHeaders(h);
    if (fromRequest && isBrandPublicOrigin(fromRequest)) {
      return normalizePublicOrigin(fromRequest);
    }
    if (fromRequest) {
      return fromRequest;
    }
  } catch {
    // headers() unavailable outside a request
  }

  const explicit = explicitSiteUrl();
  if (explicit && isBrandPublicOrigin(explicit)) {
    return normalizePublicOrigin(explicit);
  }
  if (explicit && !isEphemeralPublicOrigin(explicit)) {
    return normalizePublicOrigin(explicit);
  }

  return explicit ?? vercelSiteUrl() ?? "http://localhost:3000";
}
