"use client";

import type { Conversation } from "@/lib/chat/types";
import {
  Check,
  LoaderCircle,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 20;

type ChatSidebarProps = {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
  onConversationsChange: (conversations: Conversation[]) => void;
  onDeletedActive: () => void;
  /** Shown as an overlay above the chat page on every screen size. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DateGroup = {
  label: string;
  items: Conversation[];
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function groupConversations(conversations: Conversation[]): DateGroup[] {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const buckets: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const c of conversations) {
    const t = startOfDay(new Date(c.updated_at));
    if (Number.isNaN(t)) {
      buckets.Older!.push(c);
    } else if (t >= today) {
      buckets.Today!.push(c);
    } else if (t >= yesterday) {
      buckets.Yesterday!.push(c);
    } else if (t >= weekAgo) {
      buckets["Previous 7 days"]!.push(c);
    } else {
      buckets.Older!.push(c);
    }
  }

  return (["Today", "Yesterday", "Previous 7 days", "Older"] as const)
    .map((label) => ({ label, items: buckets[label] ?? [] }))
    .filter((g) => g.items.length > 0);
}

function mergeById(existing: Conversation[], incoming: Conversation[]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const c of existing) map.set(c.id, c);
  for (const c of incoming) map.set(c.id, c);
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  onConversationsChange,
  onDeletedActive,
  open,
  onOpenChange,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(conversations.length);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchRequestId = useRef(0);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  // Close action menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(`[data-chat-menu="${menuId}"]`)) return;
      setMenuId(null);
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [menuId]);

  const fetchInFlight = useRef(false);

  const fetchPage = useCallback(
    async (opts: { q: string; offset: number; replace: boolean }) => {
      if (fetchInFlight.current && !opts.replace) return;
      const reqId = ++searchRequestId.current;
      fetchInFlight.current = true;
      if (opts.replace) setSearching(true);
      else setLoadingMore(true);
      setError("");

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(opts.offset),
        });
        if (opts.q) params.set("q", opts.q);

        const res = await fetch(`/api/chat/conversations?${params.toString()}`);
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          conversations?: Conversation[];
          pagination?: { nextOffset: number; hasMore: boolean };
        };

        if (reqId !== searchRequestId.current) return;
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load conversations");

        const page = data.conversations ?? [];
        if (opts.replace) {
          onConversationsChange(page);
        } else {
          onConversationsChange(mergeById(conversationsRef.current, page));
        }
        setOffset(data.pagination?.nextOffset ?? opts.offset + page.length);
        setHasMore(Boolean(data.pagination?.hasMore));
      } catch (err) {
        if (reqId !== searchRequestId.current) return;
        setError(err instanceof Error ? err.message : "Failed to load conversations");
      } finally {
        if (reqId === searchRequestId.current) {
          setSearching(false);
          setLoadingMore(false);
        }
        fetchInFlight.current = false;
      }
    },
    [onConversationsChange],
  );

  // Search / reset list when query changes (including initial sync for hasMore)
  useEffect(() => {
    void fetchPage({ q: debouncedSearch, offset: 0, replace: true });
  }, [debouncedSearch, fetchPage]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (hit && hasMore && !loadingMore && !searching) {
          void fetchPage({ q: debouncedSearch, offset, replace: false });
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, searching, offset, debouncedSearch, fetchPage]);

  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  const beginRename = (conversation: Conversation) => {
    setMenuId(null);
    setRenamingId(conversation.id);
    setRenameValue(conversation.title || "");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const commitRename = async (conversationId: string) => {
    const title = renameValue.trim();
    if (!title) {
      setError("Title cannot be empty");
      return;
    }
    setBusyId(conversationId);
    setError("");
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        conversation?: Conversation;
      };
      if (!res.ok || !data.ok || !data.conversation) {
        throw new Error(data.error || "Rename failed");
      }
      onConversationsChange(
        conversationsRef.current.map((c) =>
          c.id === conversationId ? data.conversation! : c,
        ),
      );
      setRenamingId(null);
      setRenameValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusyId(null);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    setMenuId(null);
    const confirmed = window.confirm("Delete this conversation? This cannot be undone.");
    if (!confirmed) return;

    setBusyId(conversationId);
    setError("");
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "Delete failed");

      onConversationsChange(conversationsRef.current.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) onDeletedActive();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const sidebarBody = (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="space-y-2 border-b border-slate-200/80 p-3">
        <button
          type="button"
          onClick={() => {
            onNewChat();
            onOpenChange(false);
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden />
          New conversation
        </button>

        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 outline-none ring-sky-200 placeholder:text-slate-400 focus:ring-2"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
      </div>

      {error ? (
        <p className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {searching && conversations.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Searching…
          </div>
        ) : null}

        {!searching && conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-500">
            {debouncedSearch ? "No conversations match your search." : "No recent conversations yet."}
          </p>
        ) : null}

        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="px-2 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((conversation) => {
                const active = conversation.id === activeConversationId;
                const renaming = renamingId === conversation.id;
                const busy = busyId === conversation.id;

                return (
                  <li key={conversation.id} className="relative">
                    {renaming ? (
                      <div className="flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 ring-1 ring-sky-200">
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void commitRename(conversation.id);
                            }
                            if (e.key === "Escape") cancelRename();
                          }}
                          disabled={busy}
                          maxLength={80}
                          className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                          aria-label="Conversation title"
                        />
                        <button
                          type="button"
                          onClick={() => void commitRename(conversation.id)}
                          disabled={busy}
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          aria-label="Save title"
                        >
                          {busy ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={busy}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100"
                          aria-label="Cancel rename"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`group flex items-center gap-0.5 rounded-lg transition ${
                          active
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                            : "text-slate-700 hover:bg-white/80"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelect(conversation.id);
                            onOpenChange(false);
                          }}
                          className="min-w-0 flex-1 px-2.5 py-2 text-left text-sm"
                        >
                          <span className="line-clamp-1 font-medium">
                            {conversation.title || "Untitled"}
                          </span>
                          {conversation.subtitle?.trim() ? (
                            <span className="mt-0.5 line-clamp-1 text-[0.7rem] font-normal text-slate-500">
                              {conversation.subtitle.trim()}
                            </span>
                          ) : null}
                        </button>

                        <div className="relative shrink-0 pr-1" data-chat-menu={conversation.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setMenuId((id) => (id === conversation.id ? null : conversation.id))
                            }
                            className={`rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${
                              menuId === conversation.id
                                ? "opacity-100"
                                : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            }`}
                            aria-label="Conversation actions"
                          >
                            {busy ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {menuId === conversation.id ? (
                            <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => beginRename(conversation)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteConversation(conversation.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div ref={sentinelRef} className="h-4 w-full" aria-hidden />

        {loadingMore ? (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading more…
          </div>
        ) : null}

        {!hasMore && conversations.length > 0 ? (
          <p className="px-2 pb-3 pt-1 text-center text-[0.65rem] text-slate-400">
            {debouncedSearch ? "End of results" : "You’re all caught up"}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (!open) return null;

  // Overlay on every breakpoint: the chat page underneath stays mounted and
  // is revealed (and updated) as soon as the user makes a selection here.
  // On desktop the app's left nav rail stays put — the overlay (and its
  // backdrop) starts beside it rather than covering it.
  return (
    <div className="fixed inset-0 z-[130] md:left-[var(--travel-os-sidebar-w)]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close conversations"
        onClick={() => onOpenChange(false)}
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col overflow-hidden bg-slate-50 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
          <p className="text-sm font-semibold text-slate-900">Conversations</p>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1">{sidebarBody}</div>
      </div>
    </div>
  );
}
