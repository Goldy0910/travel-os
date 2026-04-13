"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type ChatMessageDTO = {
  id: string;
  trip_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type TripChatClientProps = {
  tripId: string;
  currentUserId: string;
  initialMessages: ChatMessageDTO[];
  memberLabelByUserId: Record<string, string>;
};

function formatMessageTimestamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = "numeric";
  }
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

function initialsFromLabel(label: string) {
  const s = label.trim() || "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
}

function displayName(
  userId: string,
  memberLabelByUserId: Record<string, string>,
) {
  return memberLabelByUserId[userId]?.trim() || "Member";
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export default function TripChatClient({
  tripId,
  currentUserId,
  initialMessages,
  memberLabelByUserId,
}: TripChatClientProps) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`trip-chat-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          const id = typeof row.id === "string" ? row.id : null;
          const trip_id = typeof row.trip_id === "string" ? row.trip_id : null;
          const user_id = typeof row.user_id === "string" ? row.user_id : null;
          const content = typeof row.content === "string" ? row.content : null;
          const created_at =
            typeof row.created_at === "string" ? row.created_at : null;
          if (!id || !trip_id || !user_id || content == null || !created_at) return;

          const next: ChatMessageDTO = {
            id,
            trip_id,
            user_id,
            content,
            created_at,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSendError(null);
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        trip_id: tripId,
        user_id: currentUserId,
        content: text,
      })
      .select("id, trip_id, user_id, content, created_at")
      .single();

    setSending(false);

    if (error) {
      console.error(error);
      const code = "code" in error ? String((error as { code?: string }).code) : "";
      if (code === "PGRST205") {
        const msg =
          "Chat isn’t set up on the database yet. In Supabase → SQL Editor, run the migration that creates the messages table (see travel-os/supabase/migrations/20260413_trip_messages.sql), then try again.";
        setSendError(msg);
        toast.error(msg);
      } else {
        const msg =
          (error as { message?: string }).message?.trim() ||
          "Could not send. Check your connection and try again.";
        setSendError(msg);
        toast.error(msg);
      }
      return;
    }

    if (data) {
      const row = data as ChatMessageDTO;
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });
    }
    setDraft("");
  }

  return (
    <div className="flex flex-col bg-slate-50">
      <div
        className="px-4 py-3"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-2">
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-sm font-medium text-slate-700">
                No messages yet. Say hello to your group.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Type your message in the box below, then tap{" "}
                <span className="font-semibold text-slate-700">Send</span>.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.user_id === currentUserId;
              const name = displayName(m.user_id, memberLabelByUserId);
              const initials = initialsFromLabel(name);

              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      mine
                        ? "bg-slate-900 text-white"
                        : "bg-slate-200 text-slate-700"
                    }`}
                    aria-hidden
                  >
                    {initials}
                  </div>
                  <div
                    className={`max-w-[min(100%,20rem)] min-w-0 ${mine ? "items-end text-right" : "items-start"} flex flex-col gap-0.5`}
                  >
                    {!mine ? (
                      <span className="px-1 text-xs font-medium text-slate-500">
                        {name}
                      </span>
                    ) : null}
                    <div
                      className={`rounded-2xl px-4 py-3 text-[15px] leading-snug shadow-sm ${
                        mine
                          ? "rounded-br-md bg-slate-900 text-white"
                          : "rounded-bl-md border border-slate-100 bg-white text-slate-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    <span
                      className={`px-1 text-[11px] text-slate-400 ${mine ? "text-right" : ""}`}
                    >
                      {formatMessageTimestamp(m.created_at)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} className="h-0 w-full shrink-0" aria-hidden />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-slate-200 bg-slate-100/90 px-3 py-3 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-sm"
        aria-label="Send a message"
      >
        {sendError ? (
          <p
            role="alert"
            className="mx-auto mb-2 max-w-md rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-left text-xs text-rose-800"
          >
            {sendError}
          </p>
        ) : (
          <p className="mx-auto mb-2 max-w-md text-center text-xs font-medium text-slate-500">
            Message this trip — appears for everyone on the trip
          </p>
        )}
        <div className="mx-auto flex w-full max-w-md items-end gap-2">
          <label htmlFor="trip-chat-input" className="sr-only">
            Message
          </label>
          <input
            id="trip-chat-input"
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setSendError(null);
            }}
            placeholder="Write a message…"
            autoComplete="off"
            enterKeyHint="send"
            className="min-h-[3.25rem] min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            title={draft.trim() ? "Send message" : "Type a message to send"}
            className="flex h-[3.25rem] min-w-[6.25rem] shrink-0 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white shadow-md transition enabled:bg-sky-600 enabled:active:scale-[0.97] enabled:hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:shadow-none"
          >
            {sending ? (
              <>
                <ButtonSpinner className="h-5 w-5 text-white" />
                <span>Sending…</span>
              </>
            ) : (
              <>
                <SendIcon className="h-5 w-5 shrink-0" />
                <span>Send</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
