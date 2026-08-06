/** Brand origin for shareable invite / join / OG links. */
export const CANONICAL_PUBLIC_ORIGIN = "https://traveltill99.com";

export function trimOrigin(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/\/$/, "");
  return v || undefined;
}

export function normalizePublicOrigin(origin: string): string {
  const trimmed = origin.trim().replace(/\/$/, "");
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (host === "www.traveltill99.com" || host === "traveltill99.com") {
      return CANONICAL_PUBLIC_ORIGIN;
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

export function isBrandPublicOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === "traveltill99.com" || host === "www.traveltill99.com";
  } catch {
    return false;
  }
}

/** Vercel preview / localhost — never use these in production invite links. */
export function isEphemeralPublicOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.endsWith(".local") ||
      host.endsWith(".vercel.app")
    );
  } catch {
    return true;
  }
}

/**
 * Rewrite a join/share URL onto the brand domain when the baked host is stale
 * (old Vercel URL, www, etc.). Keeps localhost / preview hosts for local testing.
 */
export function ensureBrandShareUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathAndQuery = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (isBrandPublicOrigin(parsed.origin)) {
      return `${CANONICAL_PUBLIC_ORIGIN}${pathAndQuery}`;
    }
    if (isEphemeralPublicOrigin(parsed.origin)) {
      // Preview / local — leave as-is unless we're clearly on the live brand site.
      if (
        typeof window !== "undefined" &&
        isBrandPublicOrigin(window.location.origin)
      ) {
        return `${CANONICAL_PUBLIC_ORIGIN}${pathAndQuery}`;
      }
      return url;
    }
    // Any other production-ish stale host (old custom domain, etc.) → brand.
    return `${CANONICAL_PUBLIC_ORIGIN}${pathAndQuery}`;
  } catch {
    return url;
  }
}
