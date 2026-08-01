/** First string value for a query key (Next.js App Router `searchParams`). */
export function pickSearchParam(
  query: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = query[key];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && v[0] != null && typeof v[0] === "string") return v[0].trim();
  return "";
}
