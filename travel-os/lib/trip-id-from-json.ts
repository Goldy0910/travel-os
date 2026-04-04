/** Normalize trip id from PostgREST / jsonb RPC payloads */
export function tripIdFromJson(value: unknown): string | undefined {
  if (typeof value === "string") {
    const t = value.trim();
    if (t.length > 0) return t;
  }
  return undefined;
}
