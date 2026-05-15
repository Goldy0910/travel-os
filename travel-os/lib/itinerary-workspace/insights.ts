import type { NormalizedTripPlan } from "@/lib/unified-trip/types";

export type ItineraryInsight = {
  id: string;
  icon: "sunrise" | "crowd" | "weather" | "local" | "pace";
  title: string;
  body: string;
};

type InsightInput = {
  plan: NormalizedTripPlan | null;
  destination: string;
  dayCount: number;
  activityTitles: string[];
  tripPace: "relaxed" | "balanced" | "packed";
};

export function buildItineraryInsights(input: InsightInput): ItineraryInsight[] {
  const insights: ItineraryInsight[] = [];
  const dest = input.destination || input.plan?.destination.name || "your destination";
  const titles = input.activityTitles.join(" ").toLowerCase();

  insights.push({
    id: "sunrise",
    icon: "sunrise",
    title: "Golden hour",
    body: titles.match(/beach|fort|view|point|hill|temple/)
      ? `Schedule ${dest} viewpoints near sunrise or sunset for softer light and fewer crowds.`
      : `Look for rooftop cafés or waterfront walks in ${dest} around sunrise for calmer streets.`,
  });

  insights.push({
    id: "crowd",
    icon: "crowd",
    title: "Crowd timing",
    body:
      input.tripPace === "packed"
        ? "Popular sights fill up 10am–4pm — book morning slots or late afternoons where you can."
        : "Keep one anchor sight before 10am and leave afternoons flexible for spontaneous stops.",
  });

  if (input.plan?.weather) {
    insights.push({
      id: "weather",
      icon: "weather",
      title: "Weather watch",
      body: input.plan.weather,
    });
  } else {
    insights.push({
      id: "weather",
      icon: "weather",
      title: "Weather watch",
      body: `Pack a light layer for ${dest}; check hourly rain before outdoor days.`,
    });
  }

  insights.push({
    id: "local",
    icon: "local",
    title: "Local picks",
    body: titles.match(/food|market|cafe|restaurant/)
      ? "You already have food stops — ask hosts for one hyper-local spot per neighbourhood."
      : `Add one market or street-food lane in ${dest} between major sights.`,
  });

  insights.push({
    id: "pace",
    icon: "pace",
    title: "Pacing",
    body:
      input.tripPace === "relaxed"
        ? `${input.dayCount} days at an easy pace — leave buffer between activities.`
        : input.tripPace === "packed"
          ? "Busy schedule — cluster sights by area to cut transit fatigue."
          : `Balanced ${input.dayCount}-day flow — mix anchors with open blocks each afternoon.`,
  });

  const why = input.plan?.whyThisFits?.[0];
  if (why) {
    insights.unshift({
      id: "fit",
      icon: "local",
      title: "Why this fits you",
      body: why,
    });
  }

  return insights.slice(0, 6);
}
