import { AiServiceError } from "@/lib/ai/fallback-handler";

export async function runWithAiErrorBoundary<T>(
  task: () => Promise<T>,
  message = "AI processing failed",
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    throw new AiServiceError(message, error);
  }
}
