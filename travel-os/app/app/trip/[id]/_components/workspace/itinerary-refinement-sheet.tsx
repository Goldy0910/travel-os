"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import type {
  ItineraryRefinementChange,
  ItineraryRefinementPatch,
} from "@/lib/itinerary-refinement";
import { WORKSPACE_REFINEMENT_CHIPS } from "@/lib/itinerary-workspace/quick-refinements";
import { getQuickAction } from "@/lib/trip-refinement";
import {
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useItineraryRefinement } from "./itinerary-refinement-context";

type Props = {
  tripId: string;
  destination: string;
};

type Phase = "idle" | "loading" | "preview" | "applying" | "done";

export default function ItineraryRefinementSheet({ tripId, destination }: Props) {
  const router = useRouter();
  const { registerRunRefinement, registerOpenRefinement } = useItineraryRefinement();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [patch, setPatch] = useState<ItineraryRefinementPatch | null>(null);
  const [changes, setChanges] = useState<ItineraryRefinementChange[]>([]);
  const [lastRevisionId, setLastRevisionId] = useState<string | null>(null);
  const [undoLoading, setUndoLoading] = useState(false);

  const resetPreview = useCallback(() => {
    setPatch(null);
    setChanges([]);
    setPhase("idle");
    setError(null);
  }, []);

  const runPreview = useCallback(
    async (message: string, quickActionId?: string) => {
      setPhase("loading");
      setError(null);
      setPatch(null);
      setChanges([]);

      const response = await fetch(
        `/app/trip/${encodeURIComponent(tripId)}/api/refine-itinerary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "preview",
            message,
            quickActionId,
            destination,
          }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok || data.ok !== true) {
        setPhase("idle");
        setError(typeof data.error === "string" ? data.error : "Could not build preview.");
        return;
      }

      setPatch(data.patch as ItineraryRefinementPatch);
      setChanges(Array.isArray(data.changes) ? (data.changes as ItineraryRefinementChange[]) : []);
      setPhase("preview");
    },
    [destination, tripId],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    resetPreview();
    setInputValue("");
  }, [resetPreview]);

  useEffect(() => {
    registerOpenRefinement(() => {
      setOpen(true);
      resetPreview();
    });
    registerRunRefinement((text, quickActionId) => {
      setOpen(true);
      setInputValue(text);
      void runPreview(text, quickActionId);
    });
    return () => {
      registerOpenRefinement(null);
      registerRunRefinement(null);
    };
  }, [registerOpenRefinement, registerRunRefinement, resetPreview, runPreview]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || phase === "loading" || phase === "applying") return;
    await runPreview(text);
  };

  const handleApply = async () => {
    if (!patch || phase === "applying") return;
    setPhase("applying");
    setError(null);

    const response = await fetch(
      `/app/trip/${encodeURIComponent(tripId)}/api/refine-itinerary`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", patch, destination }),
      },
    );
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok || data.ok !== true) {
      setPhase("preview");
      setError(typeof data.error === "string" ? data.error : "Could not apply changes.");
      return;
    }

    const revisionId = typeof data.revisionId === "string" ? data.revisionId : null;
    setLastRevisionId(revisionId);
    setPhase("done");
    router.refresh();
  };

  const handleUndo = async () => {
    if (!lastRevisionId || undoLoading) return;
    setUndoLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/app/trip/${encodeURIComponent(tripId)}/api/undo-revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revisionId: lastRevisionId }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || data.ok !== true) {
        setError(typeof data.error === "string" ? data.error : "Could not undo.");
        return;
      }
      setLastRevisionId(null);
      handleClose();
      router.refresh();
    } finally {
      setUndoLoading(false);
    }
  };

  const changeIcon = (type: ItineraryRefinementChange["type"]) => {
    if (type === "add") return <Plus className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
    if (type === "remove") return <Minus className="h-3.5 w-3.5 text-rose-600" aria-hidden />;
    if (type === "skipped") return <Check className="h-3.5 w-3.5 text-slate-500" aria-hidden />;
    return <Sparkles className="h-3.5 w-3.5 text-teal-600" aria-hidden />;
  };

  return (
    <BottomSheetModal
      open={open}
      onClose={handleClose}
      title="Refine itinerary"
      description="Patch only affected stops — your manual edits stay protected."
      panelClassName="max-h-[85vh]"
      zClass="z-[210]"
    >
      <div className="space-y-4 pb-2">
        {phase === "idle" || phase === "loading" ? (
          <>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. add more cafés on day 2…"
                disabled={phase === "loading"}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none ring-teal-500/30 focus:border-teal-300 focus:ring-2"
              />
              <button
                type="submit"
                disabled={phase === "loading" || !inputValue.trim()}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-teal-600 text-white transition active:scale-[0.97] disabled:opacity-50"
                aria-label="Preview refinement"
              >
                {phase === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )}
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {WORKSPACE_REFINEMENT_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={phase === "loading"}
                  onClick={() => {
                    const action = getQuickAction(chip.id);
                    if (action) void runPreview(action.prompt, chip.id);
                  }}
                  className="min-h-10 rounded-full border border-teal-200 bg-white px-3.5 py-2 text-xs font-semibold text-teal-900 transition active:scale-[0.97] disabled:opacity-50 touch-manipulation"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {phase === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" aria-hidden />
            Building preview…
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}

        {(phase === "preview" || phase === "applying" || phase === "done") && patch ? (
          <div className="space-y-3 animate-in fade-in duration-300">
            <p className="text-sm leading-relaxed text-slate-700">{patch.assistantMessage}</p>

            {changes.length > 0 ? (
              <ul className="max-h-52 space-y-2 overflow-y-auto overscroll-y-contain rounded-xl border border-slate-100 bg-slate-50/80 p-2 [-webkit-overflow-scrolling:touch]">
                {changes.map((c) => (
                  <li
                    key={c.id}
                    className="flex gap-2.5 rounded-lg bg-white px-3 py-2.5 text-xs shadow-sm transition-opacity duration-300"
                  >
                    <span className="mt-0.5 shrink-0">{changeIcon(c.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{c.title}</p>
                      {c.before ? (
                        <p className="mt-0.5 text-slate-500 line-through">{c.before}</p>
                      ) : null}
                      {c.after ? (
                        <p className="mt-0.5 font-medium text-teal-900">{c.after}</p>
                      ) : (
                        <p className="mt-0.5 text-slate-600">{c.detail}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                No changes needed — your plan already matches this refinement.
              </p>
            )}

            {patch.preservedUserEdits > 0 ? (
              <p className="text-xs text-slate-500">
                {patch.preservedUserEdits} manually edited{" "}
                {patch.preservedUserEdits === 1 ? "stop" : "stops"} left unchanged.
              </p>
            ) : null}

            {phase === "done" ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  Changes applied to your itinerary
                </div>
                {lastRevisionId ? (
                  <button
                    type="button"
                    onClick={() => void handleUndo()}
                    disabled={undoLoading}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 active:scale-[0.98] disabled:opacity-50"
                  >
                    {undoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Undo2 className="h-4 w-4" aria-hidden />
                    )}
                    Undo last refinement
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleClose}
                  className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetPreview();
                    setPhase("idle");
                  }}
                  disabled={phase === "applying"}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={phase === "applying" || changes.length === 0}
                  className="flex min-h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-50"
                >
                  {phase === "applying" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden />
                  )}
                  Apply changes
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </BottomSheetModal>
  );
}
