"use client";

import {
  proposalFromMessageMetadata,
  type ItineraryEditIntent,
  type ItineraryEditProposal,
  type ItineraryProposedEdit,
} from "@/lib/chat/itinerary-edit-types";
import { Check, LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type ItineraryEditProposalCardProps = {
  proposal: ItineraryEditProposal;
  /** Called after successful apply or dismiss so the parent can update message metadata. */
  onStatusChange?: (
    proposalId: string,
    status: "applied" | "dismissed",
  ) => void;
};

const INTENT_LABEL: Record<ItineraryEditIntent, string> = {
  move_activity: "Move activity",
  delete_activity: "Remove activity",
  add_activity: "Add activity",
  optimize_route: "Optimize route",
  reduce_cost: "Reduce cost",
  increase_relaxation: "Increase relaxation",
};

function opTone(op: ItineraryProposedEdit["op"]): string {
  if (op === "add") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (op === "delete") return "bg-rose-50 text-rose-800 ring-rose-200";
  if (op === "move") return "bg-sky-50 text-sky-800 ring-sky-200";
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

function opLabel(op: ItineraryProposedEdit["op"]): string {
  if (op === "add") return "Add";
  if (op === "delete") return "Remove";
  if (op === "move") return "Move";
  return "Update";
}

export default function ItineraryEditProposalCard({
  proposal,
  onStatusChange,
}: ItineraryEditProposalCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(proposal.status);

  if (status === "dismissed") return null;

  const onDismiss = () => {
    setStatus("dismissed");
    onStatusChange?.(proposal.proposalId, "dismissed");
  };

  const onApply = async () => {
    if (busy || status === "applied") return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat/apply-itinerary-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: proposal.tripId,
          proposalId: proposal.proposalId,
          intent: proposal.intent,
          summary: proposal.summary,
          edits: proposal.edits,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not apply itinerary edits");
      }
      setStatus("applied");
      onStatusChange?.(proposal.proposalId, "applied");
      toast.success(data.message || "Itinerary updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not apply edits");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2.5 w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          Proposed itinerary changes
        </p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">{proposal.summary}</p>
        <p className="mt-1 text-[0.7rem] text-slate-500">
          {INTENT_LABEL[proposal.intent]}
          {proposal.rationale ? ` · ${proposal.rationale}` : ""}
        </p>
      </div>

      <ul className="max-h-48 space-y-1.5 overflow-y-auto px-3.5 py-2.5">
        {proposal.edits.map((edit, index) => (
          <li
            key={`${edit.op}-${edit.activityId ?? edit.title ?? index}-${edit.day}`}
            className="flex items-start gap-2 text-[0.75rem] text-slate-700"
          >
            <span
              className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold ring-1 ${opTone(edit.op)}`}
            >
              {opLabel(edit.op)}
            </span>
            <span className="min-w-0 leading-snug">
              {edit.label ||
                `${opLabel(edit.op)} ${edit.title ?? "activity"} (${edit.day})`}
            </span>
          </li>
        ))}
      </ul>

      {status === "applied" ? (
        <div className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50/80 px-3.5 py-2.5 text-sm text-emerald-900">
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          Applied to your itinerary
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3.5 py-2.5">
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onApply()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden />
            )}
            Apply changes
          </button>
        </div>
      )}
    </div>
  );
}

export { proposalFromMessageMetadata };
