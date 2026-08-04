"use client";

import { memoryHasValues } from "@/lib/chat/memory-types";
import type { ConversationMemory, DiscoveryPhase } from "@/lib/chat/memory-types";
import { Compass } from "lucide-react";

type ConversationMemoryPanelProps = {
  memory: ConversationMemory | null;
};

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-xs text-slate-800">{value}</p>
    </div>
  );
}

function phaseLabel(phase: DiscoveryPhase): string {
  switch (phase) {
    case "gathering":
      return "Asking follow-ups";
    case "narrowing":
      return "Narrowing destinations";
    case "shortlist":
      return "Refining shortlist";
    case "complete":
      return "Destination selected";
    default:
      return "Discovery";
  }
}

export default function ConversationMemoryPanel({ memory }: ConversationMemoryPanelProps) {
  if (!memory || !memoryHasValues(memory)) return null;

  const discoveryOn = memory.discovery_active && memory.discovery_phase !== "idle";

  return (
    <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
      {discoveryOn ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 ring-1 ring-sky-200">
            <Compass className="h-3 w-3" aria-hidden />
            Discovery · {phaseLabel(memory.discovery_phase)}
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {memory.preferred_destination ? (
          <Chip label="Destination" value={memory.preferred_destination} />
        ) : null}
        {memory.candidate_destinations.length > 0 ? (
          <Chip label="Candidates" value={memory.candidate_destinations.join(", ")} />
        ) : null}
        {memory.budget ? <Chip label="Budget" value={memory.budget} /> : null}
        {memory.travel_duration ? (
          <Chip label="Duration" value={memory.travel_duration} />
        ) : null}
        {memory.travel_dates ? <Chip label="Dates" value={memory.travel_dates} /> : null}
        {memory.group_size ? <Chip label="Group" value={memory.group_size} /> : null}
        {memory.weather_preference ? (
          <Chip label="Weather" value={memory.weather_preference} />
        ) : null}
        {memory.visa_preference ? <Chip label="Visa" value={memory.visa_preference} /> : null}
        {memory.transport_preference ? (
          <Chip label="Transport" value={memory.transport_preference} />
        ) : null}
        {memory.interests.length > 0 ? (
          <Chip label="Interests" value={memory.interests.join(", ")} />
        ) : null}
        {memory.food_preferences.length > 0 ? (
          <Chip label="Food" value={memory.food_preferences.join(", ")} />
        ) : null}
      </div>
    </div>
  );
}
