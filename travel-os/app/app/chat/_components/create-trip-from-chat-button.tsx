"use client";

import {
  buildTripDraftFromMemory,
  isConversationReadyToCreateTrip,
} from "@/lib/chat/create-trip-from-conversation";
import type { ConversationMemory } from "@/lib/chat/memory-types";
import { CheckCircle2, LoaderCircle, MapPinned, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CreateTripFromChatButtonProps = {
  conversationId: string | null;
  memory: ConversationMemory | null;
  disabled?: boolean;
  /** Increment to open the confirm dialog (e.g. from SuggestedActions). */
  openSignal?: number;
};

const dismissKey = (conversationId: string) =>
  `travel-os-chat-trip-ready-dismissed:${conversationId}`;

export default function CreateTripFromChatButton({
  conversationId,
  memory,
  disabled,
  openSignal = 0,
}: CreateTripFromChatButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [travelers, setTravelers] = useState("");

  const ready = useMemo(() => {
    if (!conversationId || !memory) return false;
    return isConversationReadyToCreateTrip(memory);
  }, [conversationId, memory]);

  // Restore dismiss state per conversation; re-show if user clears dismiss via new ready cycle.
  useEffect(() => {
    if (!conversationId) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(sessionStorage.getItem(dismissKey(conversationId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [conversationId]);

  // If destination/dates change enough to flip ready off→on, clear dismiss so the prompt can return.
  useEffect(() => {
    if (!conversationId || !ready) return;
    // keep dismissed as-is when already ready; only reset when conversation changes (above)
  }, [conversationId, ready]);

  const onDismiss = () => {
    if (!conversationId) return;
    setDismissed(true);
    try {
      sessionStorage.setItem(dismissKey(conversationId), "1");
    } catch {
      // ignore
    }
  };

  const openConfirm = () => {
    if (!memory || !conversationId) return;
    const built = buildTripDraftFromMemory(memory);
    const params = new URLSearchParams({ conversationId });
    const draft = built.draft;
    if (draft?.travelPlaceSlug) {
      params.set("place", draft.travelPlaceSlug);
    } else if (draft?.location) {
      params.set("destination", draft.location);
    }
    // The create-trip page owns date selection. It also reads this conversation's
    // memory to prefill any details that the chat already established.
    router.push(`/app/create-trip?${params.toString()}`);
  };

  // SuggestedActions (and similar) can request the existing confirm dialog without reimplementing create.
  useEffect(() => {
    if (!openSignal) return;
    openConfirm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to openSignal ticks
  }, [openSignal]);

  const onCreate = async () => {
    if (!conversationId || busy) return;
    if (!location.trim() || !startDate || !endDate) {
      toast.error("Destination and dates are required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/chat/create-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          location: location.trim(),
          startDate,
          endDate,
          budget: budget.trim() || undefined,
          travelers: travelers.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        redirectTo?: string;
        warning?: string;
      };
      if (!res.ok || !data.ok || !data.redirectTo) {
        throw new Error(data.error || "Could not create trip");
      }
      if (data.warning) toast.message(data.warning);
      toast.success("Trip created from chat");
      setOpen(false);
      onDismiss();
      router.push(data.redirectTo);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create trip");
    } finally {
      setBusy(false);
    }
  };

  // Never auto-create. Banner is dismissible; dialog can still open via openSignal / Review.
  return (
    <>
      {ready && !dismissed ? (
        <div className="border-b border-emerald-100 bg-emerald-50/90 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            <p className="min-w-0 flex-1 text-sm font-medium text-emerald-950">
              Ready to create your trip
              <span className="mt-0.5 block text-xs font-normal text-emerald-800/80">
                Destination and dates are set. You can ignore this — nothing is created until you confirm.
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={openConfirm}
                disabled={disabled || busy}
                className="inline-flex items-center rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
              >
                Review & create
              </button>
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                className="rounded-lg p-2 text-emerald-800/70 transition hover:bg-emerald-100"
                aria-label="Dismiss ready prompt"
                title="Ignore for now"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/40 p-3 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="relative z-[1] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Confirm trip details</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review these fields, then confirm. The trip is not created until you tap Create trip.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                  <MapPinned className="h-3 w-3" aria-hidden />
                  Destination
                </span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                    Start
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                    End
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                  Budget
                </span>
                <input
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[0.7rem] font-medium uppercase tracking-wide text-slate-400">
                  Travelers
                </span>
                <input
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-sky-200 focus:ring-2"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onCreate()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Create trip
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
