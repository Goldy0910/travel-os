const SAVED_KEY = "travel-os-saved-destinations";
const PENDING_SAVE_KEY = "travel-os-pending-destination-save";
const LAST_RESULTS_KEY = "travel-os-find-destination-results";
const LAST_ANSWERS_KEY = "travel-os-find-destination-answers";

function readJsonArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function getSavedDestinationSlugs(): string[] {
  return readJsonArray(SAVED_KEY);
}

export function isDestinationSaved(slug: string): boolean {
  return getSavedDestinationSlugs().includes(slug);
}

export function saveDestinationSlug(slug: string): void {
  const next = Array.from(new Set([...getSavedDestinationSlugs(), slug]));
  localStorage.setItem(SAVED_KEY, JSON.stringify(next));
}

export function setPendingDestinationSave(slug: string): void {
  localStorage.setItem(PENDING_SAVE_KEY, slug);
}

export function consumePendingDestinationSave(): string | null {
  try {
    const slug = localStorage.getItem(PENDING_SAVE_KEY)?.trim() ?? "";
    if (!slug) return null;
    localStorage.removeItem(PENDING_SAVE_KEY);
    return slug;
  } catch {
    return null;
  }
}

export function persistQuizSession(answersJson: string, resultsJson: string): void {
  try {
    localStorage.setItem(LAST_ANSWERS_KEY, answersJson);
    localStorage.setItem(LAST_RESULTS_KEY, resultsJson);
  } catch {
    /* private mode */
  }
}

export function readPersistedResultsJson(): string | null {
  try {
    return localStorage.getItem(LAST_RESULTS_KEY);
  } catch {
    return null;
  }
}
