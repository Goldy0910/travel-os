import { DOCS_BUCKET } from "@/lib/documents/constants";

/** Extract a storage object path from a public/signed URL or raw path. */
export function extractDocumentStoragePath(
  rawUrl: string,
  bucket: string = DOCS_BUCKET,
): string | null {
  const value = rawUrl.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "");
  }
  try {
    const u = new URL(value);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/object/public/${bucket}/`,
      `/object/sign/${bucket}/`,
    ];
    for (const marker of markers) {
      const idx = u.pathname.indexOf(marker);
      if (idx >= 0) {
        return decodeURIComponent(u.pathname.slice(idx + marker.length));
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function buildDocumentStoragePath(
  userId: string,
  tripId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${tripId}/${crypto.randomUUID()}-${safeName || "document"}`;
}

export function isUserTripDocumentPath(
  filePath: string,
  userId: string,
  tripId: string,
): boolean {
  const expectedPrefix = `${userId}/${tripId}/`;
  return filePath.startsWith(expectedPrefix);
}
