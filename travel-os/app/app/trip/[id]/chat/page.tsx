import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import TripChatClient, {
  type ChatMessageDTO,
} from "./_components/trip-chat-client";

type ChatPageProps = {
  params: Promise<{ id: string }>;
};

type MemberRow = {
  user_id: string | null;
  name: string | null;
  email: string | null;
};

function memberDisplayLabel(m: MemberRow): string {
  const name = typeof m.name === "string" ? m.name.trim() : "";
  if (name.length > 0) return name;
  const email = typeof m.email === "string" ? m.email.trim() : "";
  if (email.length > 0) return email.split("@")[0] ?? email;
  return "Member";
}

export default async function TripChatPage({ params }: ChatPageProps) {
  const { id: tripId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) {
    redirect("/app/home");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) {
    redirect("/app/home");
  }

  const [{ data: messagesData }, { data: membersData }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, trip_id, user_id, content, created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase
      .from("members")
      .select("user_id, name, email")
      .eq("trip_id", tripId),
  ]);

  const initialMessages = (messagesData ?? []) as ChatMessageDTO[];

  const memberLabelByUserId: Record<string, string> = {};
  for (const row of membersData ?? []) {
    const m = row as MemberRow;
    if (m.user_id) {
      memberLabelByUserId[m.user_id] = memberDisplayLabel(m);
    }
  }
  if (!memberLabelByUserId[user.id]) {
    memberLabelByUserId[user.id] =
      user.user_metadata?.full_name?.trim?.() ||
      user.email?.split("@")[0] ||
      "You";
  }

  return (
    <TripChatClient
      tripId={tripId}
      currentUserId={user.id}
      initialMessages={initialMessages}
      memberLabelByUserId={memberLabelByUserId}
    />
  );
}
