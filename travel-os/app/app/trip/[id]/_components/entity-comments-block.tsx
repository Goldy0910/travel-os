"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useState } from "react";

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

export default function EntityCommentsBlock({
  tripId,
  entityType,
  entityId,
  currentUserId,
  initialComments,
  memberLabelByUserId,
}: EntityCommentsBlockProps) {
  const [comments, setComments] = useState<EntityCommentDTO[]>(() =>
    [...initialComments].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(
          "Comments table not found. Apply migration 20260414_entity_comments.sql in Supabase.",
        );
      } else {
        setError(
          insertError.message?.trim() || "Could not post comment. Try again.",
        );
      }
      return;
    }

    if (data) {
      setComments((prev) => {
        const row = data as EntityCommentDTO;
        if (prev.some((c) => c.id === row.id)) return prev;
        return [...prev, row].sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      });
    }
    setDraft("");
  }

  const heading =
    entityType === "activity" ? "Activity comments" : "Expense comments";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {heading}
      </p>

      {comments.length > 0 ? (
        <ul className="space-y-2">
          {comments.map((c) => {
            const name = labelFor(c.user_id, memberLabelByUserId);
            return (
              <li
                key={c.id}
                className="rounded-xl bg-white/80 px-3 py-2 text-sm ring-1 ring-slate-200/80"
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
        <p className="text-xs text-slate-500">No comments yet.</p>
      )}

      {error ? (
        <p className="rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-800">
          {error}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
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
          placeholder="Add a comment…"
          autoComplete="off"
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="min-h-10 shrink-0 rounded-lg bg-slate-800 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
        >
          {sending ? "…" : "Post"}
        </button>
      </form>
    </div>
  );
}
