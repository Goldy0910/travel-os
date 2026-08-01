"use client";

import {
  copyTextToClipboard,
  loadMessageReactions,
  REACTION_OPTIONS,
  saveMessageReactions,
  toggleReaction,
  type ReactionEmoji,
} from "@/app/app/chat/_lib/chat-client-actions";
import { Check, Copy, MoreHorizontal, SmilePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type MessageActionsProps = {
  conversationId: string | null;
  messageId: string;
  content: string;
  isUser: boolean;
  disabled?: boolean;
};

export default function MessageActions({
  conversationId,
  messageId,
  content,
  isUser,
  disabled = false,
}: MessageActionsProps) {
  const [reactions, setReactions] = useState<ReactionEmoji[]>([]);
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReactions(loadMessageReactions(conversationId, messageId));
  }, [conversationId, messageId]);

  useEffect(() => {
    if (!menuOpen && !reactOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setMenuOpen(false);
        setReactOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setReactOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, reactOpen]);

  const onCopy = async () => {
    const ok = await copyTextToClipboard(content);
    if (ok) {
      setCopied(true);
      toast.success("Message copied");
      window.setTimeout(() => setCopied(false), 1600);
    } else {
      toast.error("Couldn’t copy message");
    }
    setMenuOpen(false);
  };

  const onToggleReaction = (emoji: ReactionEmoji) => {
    if (!conversationId || disabled) return;
    const next = toggleReaction(reactions, emoji);
    setReactions(next);
    saveMessageReactions(conversationId, messageId, next);
    setReactOpen(false);
    setMenuOpen(false);
  };

  const muted = isUser ? "text-slate-300 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700";
  const activeReaction = isUser
    ? "bg-white/15 text-white"
    : "bg-sky-50 text-sky-800 ring-1 ring-sky-100";

  if (disabled || !content.trim()) return null;

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-0.5">
      {reactions.length > 0 ? (
        <div className="mr-1 flex flex-wrap items-center gap-0.5">
          {reactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggleReaction(emoji)}
              className={`rounded-md px-1 py-0.5 text-[0.8rem] leading-none transition ${activeReaction}`}
              aria-label={`Remove ${emoji} reaction`}
              title="Toggle reaction"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void onCopy()}
        className={`hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium transition sm:inline-flex ${muted}`}
        aria-label="Copy message"
      >
        {copied ? <Check className="h-3 w-3" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>

      {conversationId ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setReactOpen((o) => !o);
              setMenuOpen(false);
            }}
            className={`hidden items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-medium transition sm:inline-flex ${muted}`}
            aria-label="Add reaction"
            aria-expanded={reactOpen}
          >
            <SmilePlus className="h-3 w-3" aria-hidden />
            React
          </button>
          {reactOpen ? (
            <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              {REACTION_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(emoji)}
                  className={`rounded-lg px-1.5 py-1 text-sm transition hover:bg-slate-50 ${
                    reactions.includes(emoji) ? "bg-sky-50 ring-1 ring-sky-100" : ""
                  }`}
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setMenuOpen((o) => !o);
            setReactOpen(false);
          }}
          className={`inline-flex items-center rounded-md p-1 transition sm:hidden ${muted}`}
          aria-label="Message actions"
          aria-expanded={menuOpen}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
        {menuOpen ? (
          <div className="absolute bottom-full right-0 z-20 mb-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => void onCopy()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy message
            </button>
            {conversationId ? (
              <div className="border-t border-slate-100 px-2 py-1.5">
                <p className="px-1 pb-1 text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">
                  React
                </p>
                <div className="flex flex-wrap gap-0.5">
                  {REACTION_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onToggleReaction(emoji)}
                      className={`rounded-lg px-1.5 py-1 text-sm transition hover:bg-slate-50 ${
                        reactions.includes(emoji) ? "bg-sky-50 ring-1 ring-sky-100" : ""
                      }`}
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
