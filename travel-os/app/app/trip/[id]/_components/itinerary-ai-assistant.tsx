"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import { useTripItineraryAssistantOptional } from "./trip-itinerary-assistant-context";
import { Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type QuickActionId =
  | "running-late"
  | "skip-place"
  | "optimize-day"
  | "too-tired"
  | "rain-issue"
  | "find-food";

type RunningLateDelayOption = 30 | 60 | 120;

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  label?: string;
};

export type AiSuggestionCard = {
  id: string;
  text: string;
  tone?: "info" | "warning" | "success";
};

export type AssistantDayActivity = {
  id: string;
  title: string;
  time: string | null;
  sunsetSensitive: boolean;
  status: string;
};

type Props = {
  tripId: string;
  date: string;
  dayActivities: AssistantDayActivity[];
  skippedActivities: number;
  completedActivities: number;
  remainingActivities: number;
  tripPace: "relaxed" | "balanced" | "packed";
  energyLevel: "low" | "medium" | "high";
  travelerPreferences: string[];
  onSuggestion: (card: AiSuggestionCard) => void;
};

const QUICK_ACTIONS: Array<{ id: QuickActionId; label: string; endpoint: string }> = [
  { id: "running-late", label: "Running Late", endpoint: "running-late" },
  { id: "skip-place", label: "Skip Place", endpoint: "skip-activity" },
  { id: "optimize-day", label: "Optimize Day", endpoint: "optimize-day" },
  { id: "too-tired", label: "Too Tired", endpoint: "adjust-itinerary" },
  { id: "rain-issue", label: "Rain Issue", endpoint: "optimize-day" },
  { id: "find-food", label: "Find Food", endpoint: "adjust-itinerary" },
];

async function streamText(text: string, onChunk: (partial: string) => void): Promise<void> {
  let value = "";
  for (const char of text) {
    value += char;
    onChunk(value);
    await new Promise((resolve) => setTimeout(resolve, 8));
  }
}

export default function ItineraryAiAssistant({
  tripId,
  date,
  dayActivities,
  skippedActivities,
  completedActivities,
  remainingActivities,
  tripPace,
  energyLevel,
  travelerPreferences,
  onSuggestion,
}: Props) {
  const router = useRouter();
  const assistantCtx = useTripItineraryAssistantOptional();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [typing, setTyping] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [awaitingRunningLateDelay, setAwaitingRunningLateDelay] = useState(false);
  const [awaitingSkipSelection, setAwaitingSkipSelection] = useState(false);
  const [lastRevisionId, setLastRevisionId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assistantCtx) return;
    assistantCtx.registerOpenAssistant(() => setOpen(true));
    return () => assistantCtx.registerOpenAssistant(null);
  }, [assistantCtx]);

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "Hi! Ask me anything about today's plan, or use a quick action.",
    },
  ]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  useEffect(() => {
    if (!open || historyLoaded) return;
    let cancelled = false;
    const load = async () => {
      const response = await fetch(`/app/trip/${encodeURIComponent(tripId)}/api/assistant-chat`, {
        method: "GET",
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (cancelled) return;
      if (response.ok && Array.isArray(data.messages) && data.messages.length > 0) {
        const loaded: AssistantMessage[] = data.messages
          .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : null))
          .filter(Boolean)
          .map((m) => ({
            id: String(m!.id ?? `m-${Math.random().toString(36).slice(2)}`),
            role: (m!.role === "user" ? "user" : "assistant") as "user" | "assistant",
            text: typeof m!.text === "string" ? m!.text : "",
          }))
          .filter((m) => m.text.length > 0);
        if (loaded.length > 0) setMessages(loaded);
      }
      setHistoryLoaded(true);
      scrollToBottom();
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [historyLoaded, open, tripId]);

  const pushAssistantMessage = async (text: string, label?: string) => {
    const id = `assistant-${Date.now()}`;
    setMessages((prev) => [...prev, { id, role: "assistant", text: "", label }]);
    await streamText(text, (partial) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: partial } : m)));
    });
    scrollToBottom();
  };

  const handleChatSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || typing) return;
    setInputValue("");
    setTyping(true);
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text }]);
    scrollToBottom();
    try {
      const response = await fetch(`/app/trip/${encodeURIComponent(tripId)}/api/assistant-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          date,
          tripPace,
          energyLevel,
          currentTimeIso: new Date().toISOString(),
          dayActivities: dayActivities.map((activity) => ({
            title: activity.title,
            time: activity.time,
            status: activity.status,
            sunsetSensitive: activity.sunsetSensitive,
          })),
          skippedActivities,
          completedActivities,
          remainingActivities,
          preferences: travelerPreferences,
          weatherSummary: "",
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const assistantText =
        response.ok && data.response && typeof data.response === "object"
          ? `${String((data.response as Record<string, unknown>).message ?? "")}${
              (data.response as Record<string, unknown>).followUpQuestion
                ? ` ${(data.response as Record<string, unknown>).followUpQuestion}`
                : ""
            }`.trim()
          : typeof data.error === "string"
            ? data.error
            : "I couldn't answer that right now.";
      await pushAssistantMessage(assistantText || "I couldn't answer that right now.");
      if (response.ok && data.applied === true) {
        const revisionId = typeof data.revisionId === "string" ? data.revisionId : null;
        if (revisionId) setLastRevisionId(revisionId);
        const changes = (data.changes ?? {}) as Record<string, unknown>;
        const summaryBits: string[] = [];
        if (typeof changes.added === "number" && changes.added > 0)
          summaryBits.push(`Added ${changes.added}`);
        if (typeof changes.updated === "number" && changes.updated > 0)
          summaryBits.push(`Updated ${changes.updated}`);
        if (typeof changes.deleted === "number" && changes.deleted > 0)
          summaryBits.push(`Removed ${changes.deleted}`);
        onSuggestion({
          id: `s-chat-${Date.now()}`,
          text: summaryBits.length > 0
            ? `${summaryBits.join(" · ")} from your itinerary.`
            : "Itinerary updated by AI assistant.",
          tone: "success",
        });
        router.refresh();
      }
    } finally {
      setTyping(false);
    }
  };

  const runQuickAction = async (id: QuickActionId) => {
    const action = QUICK_ACTIONS.find((a) => a.id === id);
    if (!action || !date) return;
    if (id === "running-late") {
      setAwaitingSkipSelection(false);
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", text: action.label },
        {
          id: `assistant-delay-${Date.now()}`,
          role: "assistant",
          text: "How much are you delayed?",
        },
      ]);
      setAwaitingRunningLateDelay(true);
      scrollToBottom();
      return;
    }
    if (id === "skip-place") {
      setAwaitingRunningLateDelay(false);
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", text: action.label },
        {
          id: `assistant-skip-${Date.now()}`,
          role: "assistant",
          text: "Which activity should I skip for today?",
        },
      ]);
      setAwaitingSkipSelection(true);
      scrollToBottom();
      return;
    }
    setAwaitingSkipSelection(false);
    setAwaitingRunningLateDelay(false);
    setLoadingAction(true);
    setTyping(true);
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text: action.label }]);
    scrollToBottom();

    const firstSkippableActivityId =
      dayActivities.find((activity) => activity.status !== "completed" && activity.status !== "skipped")
        ?.id ?? undefined;

    try {
      const response = await fetch(`/app/trip/${encodeURIComponent(tripId)}/api/${action.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          nowIso: new Date().toISOString(),
          fatigueLevel: id === "too-tired" ? "high" : energyLevel,
          weatherSummary: id === "rain-issue" ? "Rain expected" : "",
          delayMinutes: undefined,
          skipActivityId: firstSkippableActivityId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const responseText =
        response.ok && typeof data.reasoning === "string"
          ? data.reasoning
          : typeof data.error === "string"
            ? data.error
            : "I couldn't process that action.";
      await pushAssistantMessage(responseText);

      if (response.ok) {
        const revisionId = typeof data.revisionId === "string" ? data.revisionId : null;
        if (revisionId) setLastRevisionId(revisionId);
        onSuggestion({
          id: `s-${Date.now()}`,
          text:
            responseText.slice(0, 160),
          tone: "info",
        });
        router.refresh();
      }
    } finally {
      setTyping(false);
      setLoadingAction(false);
    }
  };

  const applyRunningLateWithDelay = async (delay: RunningLateDelayOption) => {
    if (!date) return;
    setAwaitingRunningLateDelay(false);
    setAwaitingSkipSelection(false);
    setLoadingAction(true);
    setTyping(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-delay-${Date.now()}`,
        role: "user",
        text: `${delay === 60 ? "1 hr" : delay === 120 ? "2 hr" : "30 min"} delay`,
      },
    ]);
    scrollToBottom();

    const firstSkippableActivityId =
      dayActivities.find((activity) => activity.status !== "completed" && activity.status !== "skipped")
        ?.id ?? undefined;

    try {
      const response = await fetch(`/app/trip/${encodeURIComponent(tripId)}/api/running-late`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          nowIso: new Date().toISOString(),
          fatigueLevel: energyLevel,
          delayMinutes: delay,
          skipActivityId: firstSkippableActivityId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const responseText =
        response.ok && typeof data.reasoning === "string"
          ? data.reasoning
          : typeof data.error === "string"
            ? data.error
            : "I couldn't process running late right now.";
      await pushAssistantMessage(responseText, "Itinerary updated");

      if (response.ok) {
        const revisionId = typeof data.revisionId === "string" ? data.revisionId : null;
        if (revisionId) setLastRevisionId(revisionId);
        onSuggestion({
          id: `s-delay-${Date.now()}`,
          text: `Running late update applied: shifted schedule by ${delay} min.`,
          tone: "warning",
        });
        router.refresh();
      }
    } finally {
      setTyping(false);
      setLoadingAction(false);
    }
  };

  const applySkipActivity = async (activityId: string, activityTitle: string) => {
    if (!date || !activityId) return;
    setAwaitingSkipSelection(false);
    setAwaitingRunningLateDelay(false);
    setLoadingAction(true);
    setTyping(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-skip-${Date.now()}`,
        role: "user",
        text: `Skip: ${activityTitle}`,
      },
    ]);
    scrollToBottom();
    try {
      const response = await fetch(`/app/trip/${encodeURIComponent(tripId)}/api/skip-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          nowIso: new Date().toISOString(),
          fatigueLevel: energyLevel,
          skipActivityId: activityId,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const responseText =
        response.ok && typeof data.reasoning === "string"
          ? data.reasoning
          : typeof data.error === "string"
            ? data.error
            : "I couldn't process skip place right now.";
      await pushAssistantMessage(responseText, "Itinerary updated");

      if (response.ok) {
        const revisionId = typeof data.revisionId === "string" ? data.revisionId : null;
        if (revisionId) setLastRevisionId(revisionId);
        onSuggestion({
          id: `s-skip-${Date.now()}`,
          text: `Skipped "${activityTitle}" and rebalanced your day.`,
          tone: "info",
        });
        router.refresh();
      }
    } finally {
      setTyping(false);
      setLoadingAction(false);
    }
  };

  const handleUndoRevision = async () => {
    if (!lastRevisionId) return;
    setUndoLoading(true);
    try {
      const response = await fetch(`/app/trip/${encodeURIComponent(tripId)}/api/undo-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: lastRevisionId }),
      });
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const text = response.ok
        ? "Restored your previous itinerary snapshot."
        : typeof data.error === "string"
          ? data.error
          : "Could not undo the latest AI update.";
      await pushAssistantMessage(text);
      if (response.ok) {
        onSuggestion({
          id: `s-undo-${Date.now()}`,
          text: "Undo complete. Previous itinerary restored.",
          tone: "success",
        });
        setLastRevisionId(null);
        router.refresh();
      }
    } finally {
      setUndoLoading(false);
    }
  };

  return (
    <>
      {!assistantCtx ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--travel-os-bottom-nav-h)+0.75rem)] z-[130]">
          <div className="mx-auto flex w-full max-w-[390px] justify-end px-4 pointer-events-none">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-900/25 active:scale-95 touch-manipulation"
              aria-label="AI Assistant"
            >
              <Sparkles className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      <BottomSheetModal
        open={open}
        onClose={() => setOpen(false)}
        title="AI Travel Assistant"
        panelClassName="max-h-[86vh] min-h-[70vh]"
      >
        <div className="flex h-[min(74vh,680px)] min-h-[60vh] flex-col overflow-hidden">
          <div
            ref={chatScrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3 pr-1"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  message.role === "assistant"
                    ? "border border-slate-200 bg-white text-slate-700"
                    : "ml-auto bg-slate-900 text-white"
                }`}
              >
                {message.role === "assistant" && message.label ? (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                    {message.label}
                  </p>
                ) : null}
                {message.text || "…"}
              </div>
            ))}
            {typing ? (
              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:240ms]" />
              </div>
            ) : null}
          </div>

          <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white pt-2">
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={loadingAction}
                  onClick={() => runQuickAction(action.id)}
                  className="snap-start rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {action.label}
                </button>
              ))}
            </div>

            {awaitingRunningLateDelay ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-xs font-semibold text-amber-900">Select delay</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyRunningLateWithDelay(30)}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRunningLateWithDelay(60)}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    1 hr
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRunningLateWithDelay(120)}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    2 hr
                  </button>
                </div>
              </div>
            ) : null}

            {awaitingSkipSelection ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="text-xs font-semibold text-rose-900">Select activity to skip</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {dayActivities
                    .filter((activity) => activity.status !== "completed" && activity.status !== "skipped")
                    .slice(0, 8)
                    .map((activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => applySkipActivity(activity.id, activity.title)}
                        className="rounded-full border border-rose-300 bg-white px-3 py-1 text-xs font-semibold text-rose-800"
                      >
                        {activity.title}
                      </button>
                    ))}
                </div>
              </div>
            ) : null}

            {lastRevisionId ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-xs font-medium text-emerald-800">Last AI revision available</p>
                <button
                  type="button"
                  disabled={undoLoading}
                  onClick={handleUndoRevision}
                  className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm disabled:opacity-60"
                >
                  {undoLoading ? "Undoing..." : "Undo last change"}
                </button>
              </div>
            ) : null}

            <form onSubmit={handleChatSubmit} className="flex items-end gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask AI about your day plan..."
                rows={2}
                className="min-h-11 max-h-24 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
              />
              <button
                type="submit"
                disabled={typing || !inputValue.trim()}
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </BottomSheetModal>
    </>
  );
}
