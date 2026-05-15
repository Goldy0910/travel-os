"use client";

import { REFINEMENT_QUICK_ACTIONS } from "@/lib/trip-refinement";
import type { MasterTripFile } from "@/lib/master-trip-file";
import type { RefinableSection } from "@/lib/trip-refinement/types";
import { ChevronDown, ChevronUp, MessageCircle, Send, Sparkles } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  affectedSections?: string[];
  streaming?: boolean;
};

type Props = {
  masterId: string;
  version: number;
  file: MasterTripFile;
  onVersionChange: (version: number) => void;
  onFileUpdate: (updater: (prev: MasterTripFile) => MasterTripFile) => void;
  /** Workspace: expose runRefinement to quick-action chips */
  onRegisterRunRefinement?: (fn: ((text: string, quickActionId?: string) => void) | null) => void;
  onRegisterOpen?: (fn: (() => void) | null) => void;
  /** Hide floating FAB when workspace provides its own refine control */
  hideFloatingTrigger?: boolean;
};

function initialMessages(file: MasterTripFile): ChatMessage[] {
  const stored = file.refinementChat?.messages ?? [];
  if (stored.length > 0) {
    return stored.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      affectedSections: m.affectedSections,
    }));
  }
  return [
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask for small tweaks — I'll update only the parts that need to change. Try “make it cheaper” or use a quick chip below.",
    },
  ];
}

export default function RefinementChatPanel({
  masterId,
  version,
  file,
  onVersionChange,
  onFileUpdate,
  onRegisterRunRefinement,
  onRegisterOpen,
  hideFloatingTrigger = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(file));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeVersion, setActiveVersion] = useState(version);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveVersion(version);
  }, [version]);

  useEffect(() => {
    if (file.refinementChat?.messages?.length) {
      setMessages(initialMessages(file));
    }
  }, [file.refinementChat?.messages?.length]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const runRefinement = async (text: string, quickActionId?: string) => {
    if (loading) return;
    const trimmed = text.trim();
    if (!trimmed && !quickActionId) return;

    setLoading(true);
    const userId = `user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: trimmed || quickActionId?.replace(/-/g, " ") || "" },
    ]);
    setInput("");
    scrollToBottom();

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);

    try {
      const res = await fetch("/app/master-trip/api/refine-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterId,
          expectedVersion: activeVersion,
          message: trimmed,
          quickActionId,
        }),
      });

      if (res.status === 409) {
        toast.error("Plan updated elsewhere — refresh the page.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        return;
      }

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof (err as { error?: string }).error === "string"
            ? (err as { error: string }).error
            : "Refinement failed",
        );
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (evt.type === "token" && typeof evt.text === "string") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: evt.text as string } : m,
                ),
              );
            }
            if (evt.type === "done") {
              const nextVersion = Number(evt.version);
              if (Number.isFinite(nextVersion)) {
                setActiveVersion(nextVersion);
                onVersionChange(nextVersion);
              }
              const partial = evt.file as Partial<MasterTripFile> | undefined;
              const chatMsgs = evt.messages as MasterTripFile["refinementChat"];
              if (partial) {
                onFileUpdate((prev) => ({
                  ...prev,
                  preferences: partial.preferences ?? prev.preferences,
                  itinerary: partial.itinerary ?? prev.itinerary,
                  practical: partial.practical ?? prev.practical,
                  recommendation: {
                    ...prev.recommendation,
                    ...(partial.recommendation ?? {}),
                  },
                  refinementChat: chatMsgs ?? prev.refinementChat,
                }));
              }
              const sections = evt.affectedSections as RefinableSection[] | undefined;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          typeof evt.patch === "object" &&
                          evt.patch &&
                          typeof (evt.patch as { assistantMessage?: string }).assistantMessage ===
                            "string"
                            ? (evt.patch as { assistantMessage: string }).assistantMessage
                            : m.content,
                        streaming: false,
                        affectedSections: sections?.map(String),
                      }
                    : m,
                ),
              );
              if (Array.isArray(evt.messages)) {
                setMessages(
                  (evt.messages as Array<{ id: string; role: string; content: string }>).map(
                    (m) => ({
                      id: m.id,
                      role: m.role === "user" ? "user" : "assistant",
                      content: m.content,
                    }),
                  ),
                );
              }
            }
            if (evt.type === "error") {
              throw new Error(typeof evt.error === "string" ? evt.error : "Stream error");
            }
          } catch {
            /* skip malformed SSE lines */
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "I couldn't apply that change. Try again or pick a quick chip.", streaming: false }
            : m,
        ),
      );
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runRefinement(input);
  };

  const runRefinementRef = useRef(runRefinement);
  runRefinementRef.current = runRefinement;

  useEffect(() => {
    if (!onRegisterRunRefinement && !onRegisterOpen) return;
    onRegisterRunRefinement?.((text, quickActionId) => {
      void runRefinementRef.current(text, quickActionId);
    });
    onRegisterOpen?.(() => setOpen(true));
    return () => {
      onRegisterRunRefinement?.(null);
      onRegisterOpen?.(null);
    };
  }, [onRegisterRunRefinement, onRegisterOpen]);

  const visibleMessages = historyCollapsed ? messages.slice(-4) : messages;

  return (
    <>
      {!open && !hideFloatingTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(var(--travel-os-bottom-nav-h)+5.5rem)] right-4 z-[95] flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-900/25 transition active:scale-95 touch-manipulation"
          aria-label="Open refinement chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-[200] flex max-h-[min(85dvh,640px)] flex-col rounded-t-3xl border border-slate-200 bg-white shadow-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-600" />
              <div>
                <p className="text-sm font-bold text-slate-900">Refine trip</p>
                <p className="text-xs text-slate-500">Partial updates only</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-500 touch-manipulation"
              aria-label="Close refinement chat"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-slate-100 px-3 py-2">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {REFINEMENT_QUICK_ACTIONS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={loading}
                  onClick={() => void runRefinement(chip.prompt, chip.id)}
                  className="shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 transition active:scale-[0.98] disabled:opacity-50 touch-manipulation"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHistoryCollapsed((c) => !c)}
            className="flex items-center justify-center gap-1 border-b border-slate-50 py-1.5 text-xs font-medium text-slate-500 touch-manipulation"
          >
            {historyCollapsed ? (
              <>
                Show full history <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Collapse history <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]"
          >
            <ul className="space-y-3">
              {visibleMessages.map((m) => (
                <li
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-100 bg-slate-50 text-slate-800"
                    }`}
                  >
                    {m.streaming && !m.content ? (
                      <span className="inline-flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
                      </span>
                    ) : (
                      m.content
                    )}
                    {m.affectedSections?.length ? (
                      <p className="mt-2 text-[10px] uppercase tracking-wide opacity-70">
                        Updated: {m.affectedSections.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <form
            onSubmit={onSubmit}
            className="border-t border-slate-100 px-3 py-3"
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Make this cheaper"
                disabled={loading}
                className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-300 px-4 text-base disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white disabled:opacity-50 touch-manipulation"
                aria-label="Send"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
