"use server";

import {
  actorDisplayName,
  formatDocumentUploadedAction,
  insertTripActivityLog,
} from "@/lib/activity-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

export type SaveDocumentResult = { ok: true } | { ok: false; error: string };

export async function saveDocumentRecord(input: {
  tripId: string;
  filePath: string;
  fileName: string;
}): Promise<SaveDocumentResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const expectedPrefix = `${user.id}/${input.tripId}/`;
  if (!input.filePath.startsWith(expectedPrefix)) {
    return { ok: false, error: "Invalid upload path." };
  }

  const allowed = await isTripMember(supabase, input.tripId, user.id);
  if (!allowed) {
    return { ok: false, error: "Trip not found or access denied." };
  }

  const { data: publicUrlData } = supabase.storage
    .from(DOCS_BUCKET)
    .getPublicUrl(input.filePath);

  const { error: insertError } = await supabase.from("documents").insert({
    trip_id: input.tripId,
    user_id: user.id,
    file_name: input.fileName,
    file_url: publicUrlData.publicUrl,
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  await insertTripActivityLog(supabase, {
    tripId: input.tripId,
    userId: user.id,
    action: formatDocumentUploadedAction(actorDisplayName(user), input.fileName),
  });

  revalidatePath(`/app/trip/${input.tripId}/docs`);
  revalidatePath("/app/home");
  return { ok: true };
}

export async function updateDocumentFileName(input: {
  tripId: string;
  documentId: string;
  fileName: string;
}): Promise<SaveDocumentResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const name = input.fileName.trim();
  if (!name) {
    return { ok: false, error: "File name is required." };
  }

  const allowed = await isTripMember(supabase, input.tripId, user.id);
  if (!allowed) {
    return { ok: false, error: "Trip not found or access denied." };
  }

  const { error } = await supabase
    .from("documents")
    .update({ file_name: name })
    .eq("id", input.documentId)
    .eq("trip_id", input.tripId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/app/trip/${input.tripId}/docs`);
  return { ok: true };
}
