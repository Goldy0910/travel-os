import type { TripPreferences } from "../types";
import { runRecommendationEngine } from "../index";
import type { HomepageDecisionRequest } from "@/lib/homepage-decision/types";

/** Map homepage API request → engine preferences. */
export function homepageRequestToPreferences(req: HomepageDecisionRequest): TripPreferences {
  return {
    days: req.days,
    priorities: req.priorities,
    budget: req.budget,
    originCity: req.originCity,
    destination: req.destination,
    travelMonth: req.travelMonth,
  };
}

/** Run engine from homepage-shaped input (for server actions / routes). */
export function decideFromHomepageRequest(req: HomepageDecisionRequest) {
  return runRecommendationEngine(homepageRequestToPreferences(req));
}
