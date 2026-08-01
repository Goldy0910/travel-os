"use client";

import {
  conversationPlainText,
  conversationToJson,
  conversationToMarkdown,
  downloadTextFile,
  shareConversationText,
  slugifyFilename,
  type ExportableMessage,
} from "@/app/app/chat/_lib/chat-client-actions";
import { Download, MoreHorizontal, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ConversationToolbarProps = {
  title: string;
  conversationId: string | null;
  messages: ExportableMessage[];
  disabled?: boolean;
};

export default function ConversationToolbar({
  title,
  conversationId,
  messages,
  disabled = false,
}: ConversationToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.some((m) => m.content.trim());

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const onShare = async () => {
    const text = conversationPlainText(title, messages);
    const result = await shareConversationText(title, text);
    if (result === "shared") toast.success("Conversation shared");
    else if (result === "copied") toast.success("Conversation copied to clipboard");
    else toast.error("Couldn’t share conversation");
    setMenuOpen(false);
  };

  const onExportMarkdown = () => {
    const body = conversationToMarkdown(title, messages);
    downloadTextFile(
      `${slugifyFilename(title)}.md`,
      body,
      "text/markdown;charset=utf-8",
    );
    toast.success("Exported as Markdown");
    setMenuOpen(false);
  };

  const onExportJson = () => {
    const body = conversationToJson(title, messages, conversationId);
    downloadTextFile(
      `${slugifyFilename(title)}.json`,
      body,
      "application/json;charset=utf-8",
    );
    toast.success("Exported as JSON");
    setMenuOpen(false);
  };

  if (disabled || !hasMessages) return null;

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => void onShare()}
        className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 sm:inline-flex"
        aria-label="Share conversation"
      >
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Share
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
        aria-label="Conversation actions"
        aria-expanded={menuOpen}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => void onShare()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 sm:hidden"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            Share
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export Markdown
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export JSON
          </button>
        </div>
      ) : null}
    </div>
  );
}
