"use client";

import {
  resolveDestinationFromMemory,
} from "@/lib/chat/create-trip-from-conversation";
import type { ConversationMemory } from "@/lib/chat/memory-types";
import {
  BedDouble,
  MapPinned,
  Route,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

export type SuggestedActionsContext = {
  tripScoped: boolean;
  tripId?: string | null;
  conversationId?: string | null;
  memory?: ConversationMemory | null;
  disabled?: boolean;
  /** Opens CreateTripFromChatButton confirm when conversation is ready. */
  onRequestCreateTrip?: () => void;
  /** Sends a user message through the existing chat stream. */
  onSendPrompt: (prompt: string) => void;
};

type ActionId =
  | "generate_itinerary"
  | "create_trip"
  | "estimate_budget"
  | "find_hotels";

type SuggestedAction = {
  id: ActionId;
  label: string;
  Icon: LucideIcon;
};

function tripPath(tripId: string, tab: string) {
  return `/app/trip/${encodeURIComponent(tripId)}?tab=${encodeURIComponent(tab)}`;
}

function createTripHref(memory: ConversationMemory | null | undefined): string {
  const resolved = memory ? resolveDestinationFromMemory(memory) : null;
  if (resolved?.travelPlaceSlug) {
    return `/app/create-trip?place=${encodeURIComponent(resolved.travelPlaceSlug)}`;
  }
  if (resolved?.location) {
    return `/app/create-trip?destination=${encodeURIComponent(resolved.location)}`;
  }
  return "/app/create-trip";
}

/** Contextual but simple suggestion set for standalone vs trip-scoped chat. */
export function buildSuggestedActions(ctx: {
  tripScoped: boolean;
  memory?: ConversationMemory | null;
}): SuggestedAction[] {
  const phase = ctx.memory?.discovery_phase;
  const discovering =
    Boolean(ctx.memory?.discovery_active) ||
    phase === "gathering" ||
    phase === "narrowing" ||
    phase === "shortlist";

  if (ctx.tripScoped) {
    return [
      { id: "generate_itinerary", label: "Generate itinerary", Icon: Route },
      { id: "estimate_budget", label: "Estimate budget", Icon: Wallet },
      { id: "find_hotels", label: "Find hotels", Icon: BedDouble },
    ];
  }

  const standalone: SuggestedAction[] = [
    { id: "create_trip", label: "Create trip", Icon: MapPinned },
    { id: "estimate_budget", label: "Estimate budget", Icon: Wallet },
    { id: "find_hotels", label: "Find hotels", Icon: BedDouble },
    { id: "generate_itinerary", label: "Generate itinerary", Icon: Route },
  ];

  if (discovering) {
    // Prefer discovery / destination actions while narrowing options.
    const order: ActionId[] = [
      "estimate_budget",
      "create_trip",
      "find_hotels",
      "generate_itinerary",
    ];
    return order
      .map((id) => standalone.find((a) => a.id === id)!)
      .filter(Boolean);
  }

  return standalone;
}

type SuggestedActionsProps = SuggestedActionsContext;

export default function SuggestedActions({
  tripScoped,
  tripId = null,
  conversationId = null,
  memory = null,
  disabled = false,
  onRequestCreateTrip,
  onSendPrompt,
}: SuggestedActionsProps) {
  const router = useRouter();
  const actions = buildSuggestedActions({ tripScoped, memory });

  const run = (id: ActionId) => {
    if (disabled) return;

    switch (id) {
      case "generate_itinerary": {
        // Real generation UI lives on the trip itinerary tab (generateAiItineraryAction).
        if (tripScoped && tripId) {
          router.push(tripPath(tripId, "itinerary"));
          return;
        }
        onSendPrompt(
          "Based on what we've discussed so far, draft a day-by-day itinerary I can refine.",
        );
        return;
      }
      case "create_trip": {
        // Always start from the chat-linked form when a conversation exists.
        // Dates may still be chosen there if the discussion has not set them.
        if (conversationId && onRequestCreateTrip) {
          onRequestCreateTrip();
          return;
        }
        router.push(createTripHref(memory));
        return;
      }
      case "estimate_budget": {
        if (tripScoped && tripId) {
          router.push(tripPath(tripId, "expenses"));
          return;
        }
        onSendPrompt(
          "Estimate a realistic trip budget from what we know so far (flights, stay, food, activities), and call out what's still missing.",
        );
        return;
      }
      case "find_hotels": {
        // Closest existing product surface for place context is Guide; chat covers stay advice.
        if (tripScoped && tripId) {
          router.push(tripPath(tripId, "guides"));
          return;
        }
        onSendPrompt(
          "Suggest neighborhoods and hotel/stay options that fit our destination, dates, budget, and style.",
        );
        return;
      }
      default:
        return;
    }
  };

  return (
    <div
      className="flex max-w-[min(100%,42rem)] flex-wrap gap-1.5"
      role="group"
      aria-label="Suggested actions"
    >
      {actions.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => run(id)}
          aria-label={label}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[0.7rem] font-medium text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
        >
          <Icon className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
