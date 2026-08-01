import { buildKnowledgeCorpus } from "@/lib/destination-knowledge/corpus";
import { cosineSimilarity, embedText } from "@/lib/destination-knowledge/embed";
import type { KnowledgeChunk } from "@/lib/destination-knowledge/types";

const corpus = buildKnowledgeCorpus();
const embeddingCache = new Map<string, number[]>();

function chunkEmbedInput(chunk: KnowledgeChunk): string {
  return `${chunk.destinationName} (${chunk.country}) · ${chunk.topic} · ${chunk.title}\n${chunk.content}`;
}

export function lexicalScore(query: string, chunk: KnowledgeChunk): number {
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const hay = `${chunk.destinationName} ${chunk.country} ${chunk.topic} ${chunk.title} ${chunk.content}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 1;
  }
  const dest = chunk.destinationName.toLowerCase();
  if (dest && q.includes(dest)) score += 4;
  if (q.includes(chunk.topic)) score += 2;
  return score;
}

async function embedWithCache(
  key: string,
  text: string,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const cached = embeddingCache.get(key);
  if (cached) return cached;
  const values = await embedText(text, signal);
  if (values) embeddingCache.set(key, values);
  return values;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]!);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Hybrid RAG search: lexical shortlist → Gemini embeddings re-rank (cached).
 */
export async function similaritySearch(input: {
  query: string;
  topK?: number;
  destinationSlugs?: string[];
  signal?: AbortSignal;
}): Promise<Array<KnowledgeChunk & { score: number }>> {
  const topK = input.topK ?? 6;
  let pool = corpus;
  if (input.destinationSlugs?.length) {
    const set = new Set(input.destinationSlugs);
    const filtered = pool.filter((c) => set.has(c.destinationSlug));
    if (filtered.length) pool = filtered;
  }

  const lexicalRanked = [...pool]
    .map((chunk) => ({ chunk, lex: lexicalScore(input.query, chunk) }))
    .filter((row) => row.lex > 0)
    .sort((a, b) => b.lex - a.lex);

  const shortlist = (lexicalRanked.length ? lexicalRanked : pool.map((chunk) => ({ chunk, lex: 0 })))
    .slice(0, Math.max(topK * 5, 24));

  const queryEmbedding = await embedWithCache(
    `q:${input.query.slice(0, 500)}`,
    input.query,
    input.signal,
  );

  if (!queryEmbedding) {
    return shortlist.slice(0, topK).map(({ chunk, lex }) => ({
      ...chunk,
      score: lex || 0.01,
    }));
  }

  const rescored = await mapPool(shortlist, 5, async ({ chunk, lex }) => {
    const embedding = await embedWithCache(chunk.id, chunkEmbedInput(chunk), input.signal);
    const vector = embedding ? cosineSimilarity(queryEmbedding, embedding) : 0;
    const score = vector * 0.8 + (Math.min(lex, 14) / 14) * 0.2;
    return { ...chunk, score };
  });

  return rescored.sort((a, b) => b.score - a.score).slice(0, topK);
}

export function getCorpusSize(): number {
  return corpus.length;
}
