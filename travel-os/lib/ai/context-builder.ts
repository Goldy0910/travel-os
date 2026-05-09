import type { AiTripContext, BuildAiContextInput, ContextActivity } from "@/lib/ai/types";

function normalizeActivity(activity: ContextActivity): ContextActivity | null {
  const title = activity.title?.trim();
  if (!title) return null;
  return {
    ...activity,
    title,
    location: activity.location?.trim() || null,
    time: activity.time?.trim() || null,
    notes: activity.notes?.trim() || null,
  };
}

export function buildAiTripContext(input: BuildAiContextInput): AiTripContext {
  const activities = (input.activities ?? []).map(normalizeActivity).filter(Boolean) as ContextActivity[];
  return {
    tripId: input.tripId,
    tripTitle: input.tripTitle?.trim() || "Trip",
    destination: input.destination?.trim() || "Destination",
    currentDay: input.currentDay?.trim() || null,
    tripStartDate: input.tripStartDate?.trim() || null,
    tripEndDate: input.tripEndDate?.trim() || null,
    completedActivities: activities.filter((activity) => activity.state === "completed"),
    skippedActivities: activities.filter((activity) => activity.state === "skipped"),
    travelerPreferences: input.travelerPreferences ?? {},
    currentTimeIso: (input.currentTime ?? new Date()).toISOString(),
    cityOrLocation: input.cityOrLocation?.trim() || input.destination?.trim() || "Unknown location",
    weather: { summary: input.weatherPlaceholder?.trim() || "Weather unavailable" },
    budget: input.budget ?? { level: "unknown" },
    transportMode: input.transportMode ?? "unknown",
  };
}
