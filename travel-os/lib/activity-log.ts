import type { SupabaseClient, User } from "@supabase/supabase-js";

export function actorDisplayName(user: User): string {
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (user.email?.trim()) {
    return user.email.split("@")[0]!.trim() || user.email;
  }
  return "Someone";
}

export function formatExpenseAddedAction(actor: string, title: string): string {
  const t = title.trim() || "an";
  return `${actor} added ${t} expense`;
}

export function formatDocumentUploadedAction(actor: string, fileName: string): string {
  const n = fileName.trim() || "a file";
  return `${actor} uploaded “${n}”`;
}

export function formatItineraryActivityAddedAction(actor: string, label: string): string {
  const l = label.trim() || "an activity";
  return `${actor} added “${l}” to the itinerary`;
}

export async function insertTripActivityLog(
  supabase: SupabaseClient,
  params: { tripId: string; userId: string; action: string },
): Promise<void> {
  const action = params.action.trim();
  if (!action) return;

  const { error } = await supabase.from("activity_logs").insert({
    trip_id: params.tripId,
    user_id: params.userId,
    action,
  });

  if (error) {
    console.error("[activity_logs]", error.message);
  }
}

export async function fetchTripActivityLogs(
  supabase: SupabaseClient,
  tripId: string,
  limit = 10,
) {
  return supabase
    .from("activity_logs")
    .select("id, trip_id, user_id, action, created_at")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export function formatActivityLogTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
