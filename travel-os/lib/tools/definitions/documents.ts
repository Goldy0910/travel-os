import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  DOCS_BUCKET,
  MAX_DOCUMENT_UPLOAD_BYTES,
  TICKET_NAME_PATTERN,
} from "@/lib/documents/constants";
import { persistDocumentRecord } from "@/lib/documents/persist";
import {
  buildDocumentStoragePath,
  isUserTripDocumentPath,
} from "@/lib/documents/storage-path";
import {
  fetchTripDocument,
  requireDocumentToolAuth,
  type DocumentRow,
} from "@/lib/tools/documents/auth";
import { loadDocumentContentForAi } from "@/lib/tools/documents/content";
import {
  generateDocumentAiText,
  type GeminiPart,
} from "@/lib/tools/documents/gemini";
import type { ToolDefinition, ToolResult } from "@/lib/tools/types";
import { revalidatePath } from "next/cache";

function looksLikeTicket(fileName: string | null): boolean {
  return TICKET_NAME_PATTERN.test(fileName ?? "");
}

function toPublicDoc(row: DocumentRow) {
  return {
    id: row.id,
    tripId: row.trip_id,
    fileName: row.file_name,
    fileUrl: row.file_url,
    createdAt: row.created_at,
    looksLikeTicket: looksLikeTicket(row.file_name),
  };
}

// ─── find_document ───────────────────────────────────────────────────────────

export type FindDocumentInput = {
  tripId?: string;
  query?: string;
  documentId?: string;
  limit?: number;
};

export type FindDocumentOutput = {
  tripId: string;
  documents: Array<ReturnType<typeof toPublicDoc>>;
  count: number;
};

export const findDocumentTool: ToolDefinition<FindDocumentInput, FindDocumentOutput> = {
  name: "find_document",
  description:
    "Find trip documents by id or filename query. Returns matching documents the user can access for the trip.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      query: {
        type: "string",
        description: "Case-insensitive substring match against file_name",
      },
      documentId: {
        type: "string",
        description: "Exact document UUID to fetch",
        minLength: 1,
      },
      limit: {
        type: "integer",
        description: "Max results (default 20, max 50)",
        minimum: 1,
        maximum: 50,
        default: 20,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<FindDocumentOutput>> {
    const authResult = await requireDocumentToolAuth(input.tripId, ctx);
    if (!authResult.ok) return authResult;

    const { supabase, tripId } = authResult.auth;
    const limit = input.limit ?? 20;

    if (input.documentId) {
      const doc = await fetchTripDocument(supabase, tripId, input.documentId);
      if (!doc) {
        return { ok: false, error: "Document not found", code: "NOT_FOUND" };
      }
      return {
        ok: true,
        data: { tripId, documents: [toPublicDoc(doc)], count: 1 },
      };
    }

    let query = supabase
      .from("documents")
      .select("id, trip_id, user_id, file_name, file_url, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(limit);

    const q = input.query?.trim();
    if (q) {
      // Escape LIKE wildcards in user input.
      const escaped = q.replace(/[%_]/g, "\\$&");
      query = query.ilike("file_name", `%${escaped}%`);
    }

    const { data, error } = await query;
    if (error) {
      return { ok: false, error: error.message, code: "HANDLER_ERROR" };
    }

    const documents = (data ?? []).map((row) =>
      toPublicDoc({
        id: String(row.id),
        trip_id: String(row.trip_id),
        user_id: row.user_id != null ? String(row.user_id) : null,
        file_name: row.file_name != null ? String(row.file_name) : null,
        file_url: row.file_url != null ? String(row.file_url) : null,
        created_at: row.created_at != null ? String(row.created_at) : null,
      }),
    );

    return { ok: true, data: { tripId, documents, count: documents.length } };
  },
};

// ─── upload_document ─────────────────────────────────────────────────────────

export type UploadDocumentInput = {
  tripId?: string;
  fileName: string;
  /**
   * Path of a file already uploaded to the trip-docs bucket under
   * `{userId}/{tripId}/…`. Prefer this when the client uploaded via Storage.
   */
  storagePath?: string;
  /** Raw file bytes as base64 (no data: URL prefix). Max 5 MB decoded. */
  base64Data?: string;
  /** MIME type for base64Data / remote fetch (e.g. application/pdf, image/jpeg). */
  contentType?: string;
  /** Optional HTTP(S) URL to fetch and store (signed or public). */
  sourceUrl?: string;
};

export type UploadDocumentOutput = {
  documentId: string | null;
  tripId: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
};

function stripDataUrlPrefix(value: string): { base64: string; mime?: string } {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(value.trim());
  if (match) {
    return { mime: match[1], base64: match[2] ?? "" };
  }
  return { base64: value.trim() };
}

export const uploadDocumentTool: ToolDefinition<UploadDocumentInput, UploadDocumentOutput> = {
  name: "upload_document",
  description:
    "Persist a trip document. Browser File uploads are not available in tool handlers — pass an existing storagePath under `{userId}/{tripId}/`, or base64Data (+ contentType), or a sourceUrl to fetch. Reuses the same documents table / activity log as the Docs UI.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["fileName"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      fileName: {
        type: "string",
        description: "Display file name including extension",
        minLength: 1,
        maxLength: 240,
      },
      storagePath: {
        type: "string",
        description:
          "Existing object path in the trip-docs bucket (`{userId}/{tripId}/…`). Skips binary upload.",
      },
      base64Data: {
        type: "string",
        description: "File contents as base64 (optional data: URL prefix allowed)",
      },
      contentType: {
        type: "string",
        description: "MIME type when uploading base64Data or sourceUrl",
      },
      sourceUrl: {
        type: "string",
        description: "HTTP(S) URL to download and store in the trip-docs bucket",
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<UploadDocumentOutput>> {
    const authResult = await requireDocumentToolAuth(input.tripId, ctx);
    if (!authResult.ok) return authResult;

    const { supabase, user, tripId } = authResult.auth;
    const fileName = input.fileName.trim();
    if (!fileName) {
      return { ok: false, error: "fileName is required", code: "INVALID_INPUT" };
    }
    if (!ALLOWED_DOCUMENT_EXTENSIONS.test(fileName)) {
      return {
        ok: false,
        error: "Unsupported file type. Use PDF, image, or common office/text formats.",
        code: "INVALID_INPUT",
      };
    }

    const modes = [input.storagePath, input.base64Data, input.sourceUrl].filter(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    if (modes.length !== 1) {
      return {
        ok: false,
        error: "Provide exactly one of storagePath, base64Data, or sourceUrl",
        code: "INVALID_INPUT",
      };
    }

    let filePath = input.storagePath?.trim() ?? "";

    if (input.storagePath?.trim()) {
      filePath = input.storagePath.trim();
      if (!isUserTripDocumentPath(filePath, user.id, tripId)) {
        return {
          ok: false,
          error: `storagePath must start with ${user.id}/${tripId}/`,
          code: "INVALID_INPUT",
        };
      }
      const { error: existsError } = await supabase.storage
        .from(DOCS_BUCKET)
        .createSignedUrl(filePath, 60);
      if (existsError) {
        return {
          ok: false,
          error: existsError.message || "storagePath not found in bucket",
          code: "INVALID_INPUT",
        };
      }
    } else {
      let bytes: Buffer;
      let contentType =
        input.contentType?.trim() || "application/octet-stream";

      if (input.base64Data?.trim()) {
        const parsed = stripDataUrlPrefix(input.base64Data);
        if (parsed.mime) contentType = parsed.mime;
        try {
          bytes = Buffer.from(parsed.base64, "base64");
        } catch {
          return { ok: false, error: "Invalid base64Data", code: "INVALID_INPUT" };
        }
      } else {
        const url = input.sourceUrl!.trim();
        if (!/^https?:\/\//i.test(url)) {
          return {
            ok: false,
            error: "sourceUrl must be http(s)",
            code: "INVALID_INPUT",
          };
        }
        try {
          const response = await fetch(url, { signal: ctx.signal });
          if (!response.ok) {
            return {
              ok: false,
              error: `Failed to fetch sourceUrl (HTTP ${response.status})`,
              code: "HANDLER_ERROR",
            };
          }
          const remoteType = response.headers.get("content-type");
          if (remoteType) contentType = remoteType.split(";")[0]!.trim() || contentType;
          const ab = await response.arrayBuffer();
          bytes = Buffer.from(ab);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") throw err;
          return {
            ok: false,
            error: err instanceof Error ? err.message : "Failed to fetch sourceUrl",
            code: "HANDLER_ERROR",
          };
        }
      }

      if (!bytes.byteLength) {
        return { ok: false, error: "Empty file contents", code: "INVALID_INPUT" };
      }
      if (bytes.byteLength > MAX_DOCUMENT_UPLOAD_BYTES) {
        return {
          ok: false,
          error: `File too large (${bytes.byteLength} bytes). Max ${MAX_DOCUMENT_UPLOAD_BYTES} bytes.`,
          code: "INVALID_INPUT",
        };
      }

      filePath = buildDocumentStoragePath(user.id, tripId, fileName);
      const { error: uploadError } = await supabase.storage
        .from(DOCS_BUCKET)
        .upload(filePath, bytes, {
          upsert: false,
          contentType: contentType || "application/octet-stream",
        });
      if (uploadError) {
        return { ok: false, error: uploadError.message, code: "HANDLER_ERROR" };
      }
    }

    const persisted = await persistDocumentRecord(supabase, user, {
      tripId,
      filePath,
      fileName,
    });
    if (!persisted.ok) {
      return { ok: false, error: persisted.error, code: "HANDLER_ERROR" };
    }

    revalidatePath(`/app/trip/${tripId}`);
    revalidatePath(`/app/trip/${tripId}/docs`);
    revalidatePath("/app/home");

    return {
      ok: true,
      data: {
        documentId: persisted.documentId,
        tripId,
        fileName: persisted.fileName,
        fileUrl: persisted.fileUrl,
        filePath: persisted.filePath,
      },
    };
  },
};

// ─── explain_document ────────────────────────────────────────────────────────

export type ExplainDocumentInput = {
  tripId?: string;
  documentId: string;
  question?: string;
};

export type ExplainDocumentOutput = {
  documentId: string;
  fileName: string | null;
  explanation: string;
};

export const explainDocumentTool: ToolDefinition<
  ExplainDocumentInput,
  ExplainDocumentOutput
> = {
  name: "explain_document",
  description:
    "Explain a trip document using its file contents/metadata. Focuses on travel-relevant details (what it is, key fields, next actions). Does not invent booking details that are not present.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["documentId"],
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      documentId: {
        type: "string",
        description: "Document UUID to explain",
        minLength: 1,
      },
      question: {
        type: "string",
        description: "Optional focus question (e.g. departure time)",
        maxLength: 500,
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<ExplainDocumentOutput>> {
    const authResult = await requireDocumentToolAuth(input.tripId, ctx);
    if (!authResult.ok) return authResult;

    const { supabase, tripId } = authResult.auth;
    const doc = await fetchTripDocument(supabase, tripId, input.documentId);
    if (!doc) {
      return { ok: false, error: "Document not found", code: "NOT_FOUND" };
    }

    const loaded = await loadDocumentContentForAi(supabase, doc);
    if (!loaded.ok) {
      return { ok: false, error: loaded.error, code: "HANDLER_ERROR" };
    }

    const content = loaded.data;
    const parts: GeminiPart[] = [];
    const focus = input.question?.trim();

    parts.push({
      text: [
        `Explain this travel document for the traveler.`,
        `File name: ${content.fileName}`,
        `MIME: ${content.mimeType}`,
        focus ? `User question: ${focus}` : "Provide a clear overview of what this document is.",
        `Rules: Only use visible content. If unclear, say so. Do not invent PNR, times, or prices. Keep under 250 words.`,
        content.textExcerpt ? `Text excerpt:\n${content.textExcerpt}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    if (content.base64 && (content.kind === "image" || content.kind === "pdf")) {
      parts.push({
        inlineData: { mimeType: content.mimeType, data: content.base64 },
      });
    }

    try {
      const explanation = await generateDocumentAiText({
        systemPrompt:
          "You are a careful travel document assistant. Be concise, factual, and privacy-conscious. Never invent booking details.",
        parts,
        signal: ctx.signal,
        maxOutputTokens: 700,
      });
      return {
        ok: true,
        data: {
          documentId: doc.id,
          fileName: doc.file_name,
          explanation,
        },
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to explain document",
        code: "HANDLER_ERROR",
      };
    }
  },
};

// ─── summarize_tickets ───────────────────────────────────────────────────────

export type SummarizeTicketsInput = {
  tripId?: string;
  documentIds?: string[];
};

export type SummarizeTicketsOutput = {
  tripId: string;
  documentCount: number;
  summary: string;
  documents: Array<{ id: string; fileName: string | null }>;
};

export const summarizeTicketsTool: ToolDefinition<
  SummarizeTicketsInput,
  SummarizeTicketsOutput
> = {
  name: "summarize_tickets",
  description:
    "Summarize ticket-like documents on a trip (boarding passes, bookings, vouchers). Optionally pass documentIds; otherwise selects files whose names look like tickets.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      tripId: {
        type: "string",
        description: "Trip UUID (falls back to tool context tripId)",
        minLength: 1,
      },
      documentIds: {
        type: "array",
        description: "Optional explicit document UUIDs to summarize",
        items: { type: "string", minLength: 1 },
      },
    },
  },
  async handler(input, ctx): Promise<ToolResult<SummarizeTicketsOutput>> {
    const authResult = await requireDocumentToolAuth(input.tripId, ctx);
    if (!authResult.ok) return authResult;

    const { supabase, tripId } = authResult.auth;
    const { data, error } = await supabase
      .from("documents")
      .select("id, trip_id, user_id, file_name, file_url, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) {
      return { ok: false, error: error.message, code: "HANDLER_ERROR" };
    }

    const all: DocumentRow[] = (data ?? []).map((row) => ({
      id: String(row.id),
      trip_id: String(row.trip_id),
      user_id: row.user_id != null ? String(row.user_id) : null,
      file_name: row.file_name != null ? String(row.file_name) : null,
      file_url: row.file_url != null ? String(row.file_url) : null,
      created_at: row.created_at != null ? String(row.created_at) : null,
    }));

    const idFilter = new Set((input.documentIds ?? []).map((id) => id.trim()).filter(Boolean));
    let selected = idFilter.size
      ? all.filter((d) => idFilter.has(d.id))
      : all.filter((d) => looksLikeTicket(d.file_name));

    // If no ticket-named files and no explicit ids, fall back to all docs (capped).
    if (!idFilter.size && selected.length === 0) {
      selected = all.slice(0, 8);
    } else {
      selected = selected.slice(0, 8);
    }

    if (selected.length === 0) {
      return {
        ok: true,
        data: {
          tripId,
          documentCount: 0,
          summary: "No documents found on this trip to summarize.",
          documents: [],
        },
      };
    }

    const parts: GeminiPart[] = [
      {
        text: [
          "Summarize these travel tickets/bookings for the trip.",
          "Extract dates, times, routes, confirmation codes, and passenger names only when clearly present.",
          "If something is missing or unreadable, say so. Do not invent details.",
          "Return a short bullet-style summary grouped by document.",
        ].join(" "),
      },
    ];

    for (const doc of selected) {
      const loaded = await loadDocumentContentForAi(supabase, doc);
      if (!loaded.ok) {
        parts.push({
          text: `Document ${doc.id} (${doc.file_name ?? "untitled"}): could not load (${loaded.error}).`,
        });
        continue;
      }
      const content = loaded.data;
      parts.push({
        text: `Document id=${doc.id} name=${content.fileName} mime=${content.mimeType}\n${content.textExcerpt ?? "(binary/image/pdf attached)"}`,
      });
      if (content.base64 && (content.kind === "image" || content.kind === "pdf")) {
        parts.push({
          inlineData: { mimeType: content.mimeType, data: content.base64 },
        });
      }
    }

    try {
      const summary = await generateDocumentAiText({
        systemPrompt:
          "You summarize travel tickets and booking documents. Be concise, structured, and strictly factual.",
        parts,
        signal: ctx.signal,
        maxOutputTokens: 1200,
      });
      return {
        ok: true,
        data: {
          tripId,
          documentCount: selected.length,
          summary,
          documents: selected.map((d) => ({ id: d.id, fileName: d.file_name })),
        },
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to summarize tickets",
        code: "HANDLER_ERROR",
      };
    }
  },
};

/** All Documents-module AI tools. */
export const documentTools = [
  findDocumentTool,
  uploadDocumentTool,
  explainDocumentTool,
  summarizeTicketsTool,
] as ToolDefinition[];
