/**
 * Preferred Gemini models for generateContent / streamGenerateContent (v1beta).
 * Try in order: cheaper/faster first, then stronger fallbacks.
 *
 * Gemini 1.5 and 2.0 Flash families are shut down — do not include them.
 * @see https://ai.google.dev/gemini-api/docs/models
 */
export const GEMINI_GENERATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
] as const;

export type GeminiGenerateModel = (typeof GEMINI_GENERATE_MODELS)[number];

/** Default single-model callers (non-fallback loops). */
export const GEMINI_DEFAULT_MODEL: GeminiGenerateModel = "gemini-3.5-flash";
