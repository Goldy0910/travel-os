import { DOCS_BUCKET } from "@/lib/documents/constants";
import { extractDocumentStoragePath } from "@/lib/documents/storage-path";
import type { DocumentRow } from "@/lib/tools/documents/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_INLINE_BYTES = 4 * 1024 * 1024;

export type DocumentContentPayload = {
  fileName: string;
  mimeType: string;
  kind: "text" | "image" | "pdf" | "binary";
  /** UTF-8 text excerpt when available. */
  textExcerpt?: string;
  /** Base64 body for Gemini inlineData (images/PDFs/small binaries). */
  base64?: string;
  storagePath: string | null;
  byteLength: number;
};

function guessMimeType(fileName: string, fileUrl: string | null): string {
  const lower = fileName.toLowerCase();
  const url = (fileUrl ?? "").toLowerCase();
  if (lower.endsWith(".pdf") || url.includes(".pdf")) return "application/pdf";
  if (/\.jpe?g$/i.test(lower) || /\.jpe?g(\?|$)/i.test(url)) return "image/jpeg";
  if (lower.endsWith(".png") || url.includes(".png")) return "image/png";
  if (lower.endsWith(".gif") || url.includes(".gif")) return "image/gif";
  if (lower.endsWith(".webp") || url.includes(".webp")) return "image/webp";
  if (lower.endsWith(".txt") || lower.endsWith(".csv")) return "text/plain";
  return "application/octet-stream";
}

function classifyKind(mimeType: string, fileName: string): DocumentContentPayload["kind"] {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  if (mimeType.startsWith("text/") || /\.(txt|csv|md|json)$/i.test(fileName)) return "text";
  return "binary";
}

/**
 * Load document bytes from storage for AI tools.
 * Caps payload size; returns metadata + optional text/base64 for Gemini.
 */
export async function loadDocumentContentForAi(
  supabase: SupabaseClient,
  doc: DocumentRow,
): Promise<{ ok: true; data: DocumentContentPayload } | { ok: false; error: string }> {
  const fileName = (doc.file_name ?? "document").trim() || "document";
  const storagePath = doc.file_url
    ? extractDocumentStoragePath(doc.file_url, DOCS_BUCKET)
    : null;

  if (!storagePath) {
    return {
      ok: true,
      data: {
        fileName,
        mimeType: guessMimeType(fileName, doc.file_url),
        kind: classifyKind(guessMimeType(fileName, doc.file_url), fileName),
        textExcerpt: `Document metadata only. Name: ${fileName}. URL: ${doc.file_url ?? "none"}.`,
        storagePath: null,
        byteLength: 0,
      },
    };
  }

  const { data: blob, error } = await supabase.storage.from(DOCS_BUCKET).download(storagePath);
  if (error || !blob) {
    return {
      ok: false,
      error: error?.message || "Could not download document from storage",
    };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType =
    (typeof blob.type === "string" && blob.type) || guessMimeType(fileName, doc.file_url);
  const kind = classifyKind(mimeType, fileName);

  if (buffer.byteLength > MAX_INLINE_BYTES) {
    return {
      ok: true,
      data: {
        fileName,
        mimeType,
        kind,
        textExcerpt: `File "${fileName}" is ${buffer.byteLength} bytes (too large to inline). Use file name and metadata only.`,
        storagePath,
        byteLength: buffer.byteLength,
      },
    };
  }

  if (kind === "text") {
    const text = buffer.toString("utf8");
    return {
      ok: true,
      data: {
        fileName,
        mimeType,
        kind,
        textExcerpt: text.slice(0, 12000),
        storagePath,
        byteLength: buffer.byteLength,
      },
    };
  }

  if (kind === "image" || kind === "pdf") {
    return {
      ok: true,
      data: {
        fileName,
        mimeType,
        kind,
        base64: buffer.toString("base64"),
        storagePath,
        byteLength: buffer.byteLength,
      },
    };
  }

  return {
    ok: true,
    data: {
      fileName,
      mimeType,
      kind,
      textExcerpt: `Binary file "${fileName}" (${mimeType}, ${buffer.byteLength} bytes). No text extraction available.`,
      storagePath,
      byteLength: buffer.byteLength,
    },
  };
}
