const EMBED_MODELS = ["text-embedding-004", "embedding-001"] as const;

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("Embedding cancelled");
    err.name = "AbortError";
    throw err;
  }
}

export async function embedText(
  text: string,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const input = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  if (!input) return null;

  for (const model of EMBED_MODELS) {
    throwIfAborted(signal);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            content: { parts: [{ text: input }] },
          }),
          signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { embedding?: { values?: number[] }; error?: { message?: string } }
        | null;
      if (!response.ok) continue;
      const values = data?.embedding?.values;
      if (Array.isArray(values) && values.length > 0) return values;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
    }
  }
  return null;
}

export async function embedTexts(
  texts: string[],
  signal?: AbortSignal,
): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  // Sequential to avoid bursting free-tier embedding quotas.
  for (const text of texts) {
    out.push(await embedText(text, signal));
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
