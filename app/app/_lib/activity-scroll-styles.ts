/** Max rows fetched for activity log feeds (homepage + trip overview). */
export const ACTIVITY_LOG_FEED_LIMIT = 20;

/** Max itinerary items loaded for “today” on the home command center. */
export const HOME_TODAY_ITINERARY_LIMIT = 24;

/**
 * Vertical cap + scroll for compact activity lists (log feed, today’s plan, recent activity).
 * Wrap the list only; keep section headings outside.
 */
export const activityListScrollAreaClass =
  "max-h-[min(38vh,18.5rem)] touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-1";
