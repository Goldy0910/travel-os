import type { QuickActionDef } from "./types";

export const REFINEMENT_QUICK_ACTIONS: QuickActionDef[] = [
  {
    id: "more-relaxing",
    label: "More Relaxing",
    prompt: "Make this trip more relaxing with slower pacing and rest-friendly activities.",
    priorityHints: ["relaxing"],
  },
  {
    id: "more-adventurous",
    label: "More Adventurous",
    prompt: "Add more adventure and active experiences while keeping the same duration.",
    priorityHints: ["adventure"],
  },
  {
    id: "reduce-budget",
    label: "Reduce Budget",
    prompt: "Make this trip cheaper with budget-friendly activities and lodging style.",
    priorityHints: ["budget-friendly"],
  },
  {
    id: "add-food-stops",
    label: "Add Food Stops",
    prompt: "Add café, local food, and culinary experiences to the itinerary.",
    priorityHints: ["food-culture"],
  },
  {
    id: "add-cafes",
    label: "Add Cafés",
    prompt: "Add café breaks and slow coffee stops throughout the itinerary.",
    priorityHints: ["food-culture"],
  },
  {
    id: "add-nightlife",
    label: "Add Nightlife",
    prompt: "Add evening and nightlife-friendly stops without changing trip length.",
  },
  {
    id: "couple-friendly",
    label: "Couple Friendly",
    prompt: "Tune this plan for a couple — romantic, unhurried, and intimate experiences.",
  },
  {
    id: "family-friendly",
    label: "Family Friendly",
    prompt: "Make this plan family-friendly with manageable pacing and kid-safe activities.",
  },
  {
    id: "hidden-gems",
    label: "Hidden Gems",
    prompt:
      "Swap tourist-heavy stops for hidden gems, local neighbourhoods, and lesser-known experiences.",
  },
  {
    id: "reduce-travel-fatigue",
    label: "Reduce Travel Fatigue",
    prompt:
      "Reduce travel fatigue — cluster activities geographically and cut long transfers between stops.",
  },
];

export function getQuickAction(id: string): QuickActionDef | undefined {
  return REFINEMENT_QUICK_ACTIONS.find((a) => a.id === id);
}
