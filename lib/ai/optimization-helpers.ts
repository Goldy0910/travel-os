import type { ContextActivity, OptimizationAction } from "@/lib/ai/types";

export function scoreActivityForContext(
  activity: ContextActivity,
  signal: { budgetLevel?: "low" | "mid" | "high" | "unknown"; weatherSummary?: string },
): number {
  let score = 50;
  if (activity.state === "completed") score -= 25;
  if (activity.state === "skipped") score -= 10;
  if (activity.estimatedDurationMinutes && activity.estimatedDurationMinutes > 180) score -= 8;
  if (signal.budgetLevel === "low" && (activity.estimatedCost ?? 0) > 50) score -= 15;
  if (
    signal.weatherSummary?.toLowerCase().includes("rain") &&
    /park|walk|viewpoint/i.test(activity.title)
  ) {
    score -= 10;
  }
  return Math.max(0, Math.min(100, score));
}

export function estimateDelayMinutes(input: {
  distanceKm?: number;
  mode: "walking" | "public_transport" | "ride_hailing" | "mixed" | "unknown";
  trafficLevel?: "low" | "medium" | "high";
}): number {
  const distance = Math.max(0, input.distanceKm ?? 0);
  const baseByMode = {
    walking: distance * 14,
    public_transport: distance * 6,
    ride_hailing: distance * 4,
    mixed: distance * 7,
    unknown: distance * 8,
  }[input.mode];
  const trafficMultiplier =
    input.trafficLevel === "high" ? 1.45 : input.trafficLevel === "medium" ? 1.2 : 1;
  return Math.round(baseByMode * trafficMultiplier);
}

export function buildOptimizationActions(activities: ContextActivity[]): OptimizationAction[] {
  if (activities.length < 2) return [];
  return activities
    .filter((activity) => activity.state !== "completed")
    .slice(0, 3)
    .map((activity) => ({
      type: "reorder",
      activityId: activity.id,
      reason: "Improve day flow and reduce transit overhead.",
      confidence: 0.65,
    }));
}
