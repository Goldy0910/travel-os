"use server";

import {
  actorDisplayName,
  formatDocumentUploadedAction,
  insertTripActivityLog,
} from "@/lib/activity-log";
import { actionError, actionSuccess, type FormActionResult } from "@/lib/form-action-result";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

export async function saveDocumentRecord(input: {
  tripId: string;
  filePath: string;
  fileName: string;
}): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const expectedPrefix = `${user.id}/${input.tripId}/`;
  if (!input.filePath.startsWith(expectedPrefix)) {
    return actionError("Invalid upload path.");
  }

  const allowed = await isTripMember(supabase, input.tripId, user.id);
  if (!allowed) {
    return actionError("Trip not found or access denied.");
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
    return actionError(insertError.message);
  }

  await insertTripActivityLog(supabase, {
    tripId: input.tripId,
    userId: user.id,
    action: formatDocumentUploadedAction(actorDisplayName(user), input.fileName),
  });

  revalidatePath(`/app/trip/${input.tripId}/docs`);
  revalidatePath("/app/home");
  return actionSuccess("Document uploaded.");
}

export async function updateDocumentFileName(input: {
  tripId: string;
  documentId: string;
  fileName: string;
}): Promise<FormActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const name = input.fileName.trim();
  if (!name) {
    return actionError("File name is required.");
  }

  const allowed = await isTripMember(supabase, input.tripId, user.id);
  if (!allowed) {
    return actionError("Trip not found or access denied.");
  }

  const { error } = await supabase
    .from("documents")
    .update({ file_name: name })
    .eq("id", input.documentId)
    .eq("trip_id", input.tripId);

  if (error) {
    return actionError(error.message);
  }

  revalidatePath(`/app/trip/${input.tripId}/docs`);
  return actionSuccess("Document renamed.");
}
