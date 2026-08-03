"use client";

import type { ConversationMemory } from "@/lib/chat/memory-types";
import { ChevronDown, Plus } from "lucide-react";

type ChatExploreHeaderProps = {
  title: string;
  memory: ConversationMemory | null;
  onCreateTrip: () => void;
  createTripDisabled?: boolean;
};

function Pill({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const filled = Boolean(value?.trim());
  return (
    <span
      className={`inline-flex max-w-[11rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
        filled
          ? "border-slate-300 bg-white text-slate-800"
          : "border-slate-200 bg-slate-50 text-slate-500"
      }`}
      title={filled ? `${label}: ${value}` : label}
    >
      <span className="text-slate-400">{label}</span>
      {filled ? <span className="truncate">{value}</span> : null}
    </span>
  );
}

/**
 * Mindtrip-inspired chat header: conversation title + trip filter pills + Create trip.
 */
export default function ChatExploreHeader({
  title,
  memory,
  onCreateTrip,
  createTripDisabled,
}: ChatExploreHeaderProps) {
  const where =
    memory?.preferred_destination?.trim() ||
    memory?.candidate_destinations?.[0]?.trim() ||
    null;
  const when = memory?.travel_dates?.trim() || memory?.travel_duration?.trim() || null;
  const who = memory?.group_size?.trim() || null;
  const budget = memory?.budget?.trim() || null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5 md:flex-row md:items-center md:gap-3">
      <div className="min-w-0 md:max-w-[13rem]">
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1 truncate text-left text-sm font-semibold text-slate-900"
          aria-label={`Conversation: ${title}`}
        >
          <span className="truncate">{title || "New chat"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Pill label="Where" value={where} />
        <Pill label="Starting" value={when} />
        <Pill label="Who" value={who} />
        <Pill label="Budget" value={budget} />
      </div>

      <button
        type="button"
        onClick={onCreateTrip}
        disabled={createTripDisabled}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Create a trip
      </button>
    </div>
  );
}
