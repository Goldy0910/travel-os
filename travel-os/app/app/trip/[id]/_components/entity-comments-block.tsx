"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ChevronDown, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type EntityCommentDTO = {
  id: string;
  trip_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  content: string;
  created_at: string;
};

export type EntityCommentEntityType = "activity" | "expense";

type EntityCommentsBlockProps = {
  tripId: string;
  entityType: EntityCommentEntityType;
  entityId: string;
  currentUserId: string;
  initialComments: EntityCommentDTO[];
  memberLabelByUserId: Record<string, string>;
  /** Itinerary cards: collapsible thread + design-token styling. Expenses keep the default block. */
  collapsible?: boolean;
  /**
   * When provided in `collapsible` mode, the parent controls open/closed and the internal
   * toggle row is hidden. Used by the redesigned itinerary card where the row chevron toggles
   * the inline comment panel.
   */
  externalOpen?: boolean;
};

function formatCommentTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function labelFor(
  userId: string,
  memberLabelByUserId: Record<string, string>,
) {
  return memberLabelByUserId[userId]?.trim() || "Member";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[1]?.[0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  const one = parts[0] ?? "";
  if (one.length >= 2) return one.slice(0, 2).toUpperCase();
  return (one[0] ?? "?").toUpperCase();
}

/** Newest first for display */
function sortCommentsNewestFirst(list: EntityCommentDTO[]) {
  return [...list].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export default function EntityCommentsBlock({
  tripId,
  entityType,
  entityId,
  currentUserId,
  initialComments,
  memberLabelByUserId,
  collapsible = false,
  externalOpen,
}: EntityCommentsBlockProps) {
  const [comments, setComments] = useState<EntityCommentDTO[]>(() =>
    sortCommentsNewestFirst(initialComments),
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [internalThreadOpen, setInternalThreadOpen] = useState(false);
  const isControlled = typeof externalOpen === "boolean";
  const threadOpen = isControlled ? (externalOpen as boolean) : internalThreadOpen;
  const setThreadOpen = (next: boolean) => {
    if (!isControlled) setInternalThreadOpen(next);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setError(null);
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: insertError } = await supabase
      .from("comments")
      .insert({
        trip_id: tripId,
        user_id: currentUserId,
        entity_type: entityType,
        entity_id: entityId.trim(),
        content: text,
      })
      .select("id, trip_id, user_id, entity_type, entity_id, content, created_at")
      .single();

    setSending(false);

    if (insertError) {
      const code =
        "code" in insertError
          ? String((insertError as { code?: string }).code)
          : "";
      if (code === "PGRST205") {
        const msg =
          "Comments table not found. Apply migration 20260414_entity_comments.sql in Supabase.";
        setError(msg);
        toast.error(msg);
      } else {
        const msg = insertError.message?.trim() || "Could not post comment. Try again.";
        setError(msg);
        toast.error(msg);
      }
      return;
    }

    if (data) {
      setComments((prev) => {
        const row = data as EntityCommentDTO;
        if (prev.some((c) => c.id === row.id)) return prev;
        return sortCommentsNewestFirst([...prev, row]);
      });
      if (collapsible) setThreadOpen(true);
    }
    setDraft("");
    toast.success("Comment posted.");
  }

  const heading =
    entityType === "activity" ? "Activity comments" : "Expense comments";

  const meLabel = labelFor(currentUserId, memberLabelByUserId);
  const meInitials = initialsFromName(meLabel);

  if (collapsible) {
    const count = comments.length;
    return (
      <div
        className={
          isControlled
            ? "border-t border-black/[0.08] bg-[#f8f8f6]"
            : "mt-0 border-t border-black/[0.08] pt-2"
        }
      >
        {isControlled ? null : (
          <button
            type="button"
            onClick={() => setThreadOpen(!threadOpen)}
            className="flex w-full min-h-9 touch-manipulation items-center gap-1.5 rounded-lg px-0.5 py-0.5 text-left transition-colors hover:bg-black/[0.03]"
            aria-expanded={threadOpen}
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
            <span className="min-w-0 flex-1 text-[13px] text-slate-700">
              {count === 0 ? "Comments" : `${count} comment${count === 1 ? "" : "s"}`}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 ${
                threadOpen ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        )}

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-out ${
            threadOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={
                isControlled
                  ? "px-3 py-2.5"
                  : "mt-1.5 rounded-lg bg-[#f8f8f6] p-2"
              }
            >
              {comments.length > 0 ? (
                <ul className="mb-2 max-h-[7.5rem] space-y-2 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
                  {comments.map((c) => {
                    const name = labelFor(c.user_id, memberLabelByUserId);
                    const isSelf = c.user_id === currentUserId;
                    const bubbleInitials = initialsFromName(name);
                    return (
                      <li key={c.id} className="flex gap-1.5">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                            isSelf
                              ? "bg-[#E6F1FB] text-[#0C447C]"
                              : "bg-[#EAF3DE] text-[#27500A]"
                          }`}
                          aria-hidden
                        >
                          {bubbleInitials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div
                            className="border border-black/[0.08] bg-white px-2 py-1.5 shadow-sm"
                            style={{
                              borderRadius: "0 8px 8px 8px",
                            }}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                              <span className="text-[10px] font-medium text-slate-500">{name}</span>
                              <span className="text-[10px] text-slate-400">
                                {formatCommentTime(c.created_at)}
                              </span>
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-snug text-slate-800">
                              {c.content}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {error ? (
                <p className="mb-1.5 rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
                  {error}
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6F1FB] text-[10px] font-semibold text-[#0C447C]"
                  aria-hidden
                >
                  {meInitials}
                </div>
                <label htmlFor={`comment-${entityType}-${entityId}`} className="sr-only">
                  Add comment
                </label>
                <input
                  id={`comment-${entityType}-${entityId}`}
                  type="text"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setError(null);
                  }}
                  placeholder={
                    count === 0 ? "Be the first to comment…" : "Write a comment…"
                  }
                  autoComplete="off"
                  className="min-h-8 min-w-0 flex-1 rounded-full border border-transparent bg-white/80 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-black/10 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1a2340]/15"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="flex min-h-8 shrink-0 items-center justify-center rounded-full bg-[#1a2340] px-3 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {sending ? <ButtonSpinner className="h-3 w-3 text-white" /> : "Post"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {heading}
      </p>

      <div
        className="min-h-[4.5rem] overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/80"
        aria-label={heading}
      >
        {comments.length > 0 ? (
          <ul
            className="max-h-44 space-y-2 overflow-y-auto overscroll-contain px-2 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable]"
            role="list"
          >
            {comments.map((c) => {
              const name = labelFor(c.user_id, memberLabelByUserId);
              return (
                <li
                  key={c.id}
                  className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200/80"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <span className="font-medium text-slate-800">{name}</span>
                    <span className="text-[11px] text-slate-400">
                      {formatCommentTime(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-slate-700">
                    {c.content}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full min-h-[4.5rem] items-center justify-center px-3 py-4">
            <p className="text-center text-xs text-slate-500">No comments yet.</p>
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 z-10 -mx-1 flex gap-2 rounded-xl bg-slate-50/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-slate-50/85"
      >
        <label htmlFor={`comment-flat-${entityType}-${entityId}`} className="sr-only">
          Add comment
        </label>
        <input
          id={`comment-flat-${entityType}-${entityId}`}
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="Add a comment…"
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {sending ? (
            <>
              <ButtonSpinner className="h-3.5 w-3.5 text-white" />
              Post
            </>
          ) : (
            "Post"
          )}
        </button>
      </form>
    </div>
  );
}
