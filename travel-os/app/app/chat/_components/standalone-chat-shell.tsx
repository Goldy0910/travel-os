import AIChat from "@/app/app/chat/_components/ai-chat";
import { loadConversationMemory } from "@/lib/chat/memory";
import type { ConversationMemory } from "@/lib/chat/memory-types";
import type { Conversation, ConversationMessage } from "@/lib/chat/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { SetAppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

function pickParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  return null;
}

type StandaloneChatShellProps = {
  searchParams?: Promise<SearchParams>;
  /** Header title for the landing chat surface. */
  headerTitle?: string;
  showBack?: boolean;
};

/**
 * Standalone (non-trip) AI chat shell — used as the app home landing and `/app/chat`.
 * Trip-owned conversations redirect into the trip Chat tab.
 */
export default async function StandaloneChatShell({
  searchParams,
  headerTitle = "Travel Till 99",
  showBack = false,
}: StandaloneChatShellProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const params = (await searchParams) ?? {};
  const conversationId = pickParam(params.c);

  // Standalone inbox only — trip-owned conversations live on the trip Chat tab.
  let listQuery = supabase
    .from("conversations")
    .select("id, user_id, title, created_at, updated_at, trip_id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  let { data: conversationsData, error: conversationsError } = await listQuery.is(
    "trip_id",
    null,
  );

  if (
    conversationsError &&
    /trip_id|schema cache|PGRST|column/i.test(conversationsError.message)
  ) {
    const fallback = await supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    conversationsData = fallback.data as typeof conversationsData;
    conversationsError = fallback.error;
  }

  let conversations = (conversationsError ? [] : conversationsData ?? []) as Conversation[];
  const migrationMissing =
    !!conversationsError &&
    /could not find the table|schema cache|PGRST205/i.test(conversationsError.message);

  let initialMessages: ConversationMessage[] = [];
  let initialConversationId: string | null = null;
  let initialMemory: ConversationMemory | null = null;

  if (conversationId && !migrationMissing) {
    const { data: owned, error: ownedError } = await supabase
      .from("conversations")
      .select("id, user_id, title, created_at, updated_at, trip_id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    let row = owned as (Conversation & { trip_id?: string | null }) | null;
    if (ownedError && /trip_id|schema cache|PGRST|column/i.test(ownedError.message)) {
      const fallback = await supabase
        .from("conversations")
        .select("id, user_id, title, created_at, updated_at")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();
      row = fallback.data as Conversation | null;
    }

    if (row) {
      const tripOwned =
        typeof row.trip_id === "string" && row.trip_id.trim() ? row.trip_id.trim() : "";
      if (tripOwned) {
        redirect(`/app/trip/${encodeURIComponent(tripOwned)}`);
      }

      initialConversationId = row.id;
      if (!conversations.some((c) => c.id === row.id)) {
        conversations = [row, ...conversations];
      }
      const { data: messagesData } = await supabase
        .from("conversation_messages")
        .select("id, conversation_id, role, content, metadata, created_at")
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: true });
      initialMessages = (messagesData ?? []).map((msg) => ({
        id: msg.id as string,
        conversation_id: msg.conversation_id as string,
        role: msg.role as ConversationMessage["role"],
        content: msg.content as string,
        metadata:
          msg.metadata && typeof msg.metadata === "object" && !Array.isArray(msg.metadata)
            ? (msg.metadata as Record<string, unknown>)
            : {},
        created_at: msg.created_at as string,
      }));
      initialMemory = await loadConversationMemory(supabase, row.id);
    }
  }

  return (
    <>
      <SetAppHeader title={headerTitle} showBack={showBack} />
      <div className="flex h-[calc(100dvh-3.5rem-var(--travel-os-bottom-nav-h,4.5rem))] min-h-0 flex-col md:h-[calc(100dvh-3.5rem)]">
        {migrationMissing ? (
          <div className="travel-os-content px-4 py-8 md:px-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-950">
              <p className="font-medium">Chat tables are not set up yet.</p>
              <p className="mt-2 text-amber-900/80">
                Run the Supabase migration{" "}
                <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">
                  20260509_standalone_chat.sql
                </code>{" "}
                then reload this page.
              </p>
            </div>
          </div>
        ) : (
          <AIChat
            initialConversations={conversations}
            initialConversationId={initialConversationId}
            initialMessages={initialMessages}
            initialMemory={initialMemory}
          />
        )}
      </div>
    </>
  );
}
