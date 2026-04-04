/**
 * Public origin for invite links, WhatsApp text, etc.
 *
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL — preferred canonical app URL (e.g. https://trips.example.com).
 * 2. NEXT_PUBLIC_SITE_URL — legacy alias for the same idea.
 * 3. VERCEL_URL — set automatically on Vercel (https://*.vercel.app).
 * 4. http://localhost:3000 — local dev only (fine for testing on your machine; not for sharing).
 */
function firstExplicitPublicUrl(
  ...keys: ("NEXT_PUBLIC_APP_URL" | "NEXT_PUBLIC_SITE_URL")[]
): string | undefined {
  for (const key of keys) {
    const v = process.env[key]?.trim().replace(/\/$/, "");
    if (v) return v;
  }
  return undefined;
}

export function getPublicSiteUrl(): string {
  const explicit = firstExplicitPublicUrl(
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SITE_URL",
  );
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) {
    if (vercel.startsWith("http://") || vercel.startsWith("https://")) {
      return vercel.replace(/\/$/, "");
    }
    return `https://${vercel}`;
  }

  return "http://localhost:3000";
}
