export const DOCS_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

/** Matches trip docs UI upload limit. */
export const MAX_DOCUMENT_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ALLOWED_DOCUMENT_EXTENSIONS =
  /\.(pdf|jpe?g|png|gif|webp|heic|bmp|svg|txt|csv|doc|docx|xls|xlsx|ppt|pptx)$/i;

/** Heuristic names for ticket-like travel documents. */
export const TICKET_NAME_PATTERN =
  /\b(ticket|e[- ]?ticket|boarding|flight|train|bus|ferry|pass|voucher|booking|reservation|confirmation|itinerary|pnr|eticket)\b/i;
