type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

function emit(event: string, payload?: AnalyticsPayload) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[find-destination:analytics] ${event}`, payload ?? {});
  }
  // Hook for Segment/GA/PostHog later:
  // window.analytics?.track?.(event, payload);
}

export const findDestinationAnalytics = {
  quizStarted: () => emit("Quiz Started"),
  quizCompleted: (payload?: AnalyticsPayload) => emit("Quiz Completed", payload),
  recommendationGenerated: (payload?: AnalyticsPayload) =>
    emit("Recommendation Generated", payload),
  destinationViewed: (slug: string) => emit("Destination Viewed", { slug }),
  createTripClicked: (slug: string) => emit("Create Trip Clicked", { slug }),
  saveClicked: (slug: string) => emit("Save Clicked", { slug }),
  shareClicked: (slug: string) => emit("Share Clicked", { slug }),
};
