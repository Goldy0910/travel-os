import {
  actorDisplayName,
  formatDocumentUploadedAction,
  insertTripActivityLog,
} from "@/lib/activity-log";
import { DOCS_BUCKET } from "@/lib/documents/constants";
import { isUserTripDocumentPath } from "@/lib/documents/storage-path";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type PersistDocumentInput = {
  tripId: string;
  filePath: string;
  fileName: string;
};

export type PersistDocumentSuccess = {
  ok: true;
  documentId: string | null;
  fileUrl: string;
  fileName: string;
  filePath: string;
};

export type PersistDocumentFailure = {
  ok: false;
  error: string;
};

export type PersistDocumentResult = PersistDocumentSuccess | PersistDocumentFailure;

/**
 * Insert a `documents` row for a file already in the trip-docs bucket.
 * Shared by the UI server action and AI upload_document tool.
 */
export async function persistDocumentRecord(
  supabase: SupabaseClient,
  user: User,
  input: PersistDocumentInput,
): Promise<PersistDocumentResult> {
  if (!isUserTripDocumentPath(input.filePath, user.id, input.tripId)) {
    return { ok: false, error: "Invalid upload path." };
  }

  const fileName = input.fileName.trim();
  if (!fileName) {
    return { ok: false, error: "File name is required." };
  }

  const { data: publicUrlData } = supabase.storage
    .from(DOCS_BUCKET)
    .getPublicUrl(input.filePath);

  const fileUrl = publicUrlData.publicUrl;

  const { data: inserted, error: insertError } = await supabase
    .from("documents")
    .insert({
      trip_id: input.tripId,
      user_id: user.id,
      file_name: fileName,
      file_url: fileUrl,
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  await insertTripActivityLog(supabase, {
    tripId: input.tripId,
    userId: user.id,
    action: formatDocumentUploadedAction(actorDisplayName(user), fileName),
  });

  return {
    ok: true,
    documentId: inserted?.id != null ? String(inserted.id) : null,
    fileUrl,
    fileName,
    filePath: input.filePath,
  };
}
