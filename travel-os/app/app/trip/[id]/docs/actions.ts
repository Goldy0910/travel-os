"use server";

import { persistDocumentRecord } from "@/lib/documents/persist";
import { actionError, actionSuccess, type FormActionResult } from "@/lib/form-action-result";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

  const allowed = await isTripMember(supabase, input.tripId, user.id);
  if (!allowed) {
    return actionError("Trip not found or access denied.");
  }

  const result = await persistDocumentRecord(supabase, user, input);
  if (!result.ok) {
    return actionError(result.error);
  }

  revalidatePath(`/app/trip/${input.tripId}`);
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

  revalidatePath(`/app/trip/${input.tripId}`);
  revalidatePath(`/app/trip/${input.tripId}/docs`);
  return actionSuccess("Document renamed.");
}
