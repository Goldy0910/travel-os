import { headers } from "next/headers";

/**
 * Public origin for invite links, WhatsApp text, etc.
 *
 * `getPublicSiteUrl()` — env + Vercel only (no request); fine for scripts.
 *
 * `getResolvedPublicSiteUrl()` — use in Server Components: prefers env, then the
 * actual request host (custom domain, preview URL), then VERCEL_URL, then localhost.
 */

function trimOrigin(value: string | undefined): string | undefined {
  const v = value?.trim().replace(/\/$/, "");
  return v || undefined;
}

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
  return (
    explicitSiteUrl() ?? vercelSiteUrl() ?? "http://localhost:3000"
  );
}

export async function getResolvedPublicSiteUrl(): Promise<string> {
  const explicit = explicitSiteUrl();
  if (explicit) {
    if (process.env.NODE_ENV === "development") {
      console.log("[public-site-url] resolved (explicit env):", explicit, {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      });
    }
    return explicit;
  }

  const h = await headers();
  const fromRequest = originFromIncomingHeaders(h);
  if (fromRequest) {
    if (process.env.NODE_ENV === "development") {
      console.log("[public-site-url] resolved (request host):", fromRequest, {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      });
    }
    return fromRequest;
  }

  const vercel = vercelSiteUrl();
  if (vercel) {
    if (process.env.NODE_ENV === "development") {
      console.log("[public-site-url] resolved (VERCEL_URL):", vercel, {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      });
    }
    return vercel;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[public-site-url] resolved (fallback localhost). ENV CHECK:", {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
    });
  }

  return "http://localhost:3000";
}
