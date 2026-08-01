import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import { TOPIC_QUERY_HINTS } from "@/lib/destination-knowledge/topics";
import type { KnowledgeTopic } from "@/lib/destination-knowledge/types";
import { similaritySearch } from "@/lib/destination-knowledge/vector-store";
import type { DestinationKnowledgeResult, RetrievedChunk } from "@/lib/destination-knowledge/types";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectKnowledgeTopics(question: string): KnowledgeTopic[] {
  const q = question.toLowerCase();
  const hits: KnowledgeTopic[] = [];
  for (const [topic, hints] of Object.entries(TOPIC_QUERY_HINTS) as Array<
    [KnowledgeTopic, string[]]
  >) {
    if (hints.some((h) => q.includes(h))) hits.push(topic);
  }
  if (/\bvs\b|versus|compare|difference between/i.test(question) && !hits.includes("compare")) {
    hits.push("compare");
  }
  return hits.length ? hits : ["overview"];
}

export function detectDestinationMentions(question: string): string[] {
  const q = normalize(question);
  const found: string[] = [];
  for (const dest of DESTINATION_CATALOG) {
    const name = normalize(dest.name);
    const country = normalize(dest.country);
    const slug = normalize(dest.slug.replace(/-/g, " "));
    if (
      (name && q.includes(name)) ||
      (slug && q.includes(slug)) ||
      (country.length > 3 && q.includes(country) && name && q.includes(name.split(" ")[0]!))
    ) {
      found.push(dest.slug);
    }
  }
  // Country-only helpers for common compares
  if (/\bthailand\b/i.test(question) && !found.includes("bangkok-thailand")) {
    found.push("bangkok-thailand");
  }
  if (/\bjapan\b/i.test(question) && !found.includes("tokyo-japan")) {
    found.push("tokyo-japan");
  }
  if (/\bindonesia\b/i.test(question) && !found.includes("bali-indonesia")) {
    found.push("bali-indonesia");
  }
  return Array.from(new Set(found));
}

/** Resolve free-text destination names to catalog slugs. */
export function resolveDestinationSlugs(names: string[]): string[] {
  const found: string[] = [];
  for (const raw of names) {
    const n = normalize(raw);
    if (!n) continue;
    const hit = DESTINATION_CATALOG.find((d) => {
      const name = normalize(d.name);
      const slug = normalize(d.slug.replace(/-/g, " "));
      return n === name || n === slug || n.includes(name) || name.includes(n) || slug.includes(n);
    });
    if (hit) found.push(hit.slug);
  }
  return Array.from(new Set(found));
}

const KNOWLEDGE_CUES: RegExp[] = [
  /\bexpensive\b/i,
  /\bcheap\b/i,
  /\bcost\b/i,
  /\bbudget\b/i,
  /\bsafe(ty)?\b/i,
  /\bsolo\b/i,
  /\binternet\b/i,
  /\bwifi\b/i,
  /\bwi-fi\b/i,
  /\btransport\b/i,
  /\bgetting around\b/i,
  /\bfood\b/i,
  /\bnightlife\b/i,
  /\bfamily[- ]?friendly\b/i,
  /\bcompare\b/i,
  /\bvs\b/i,
  /\bversus\b/i,
  /\bvisa\b/i,
  /\bweather\b/i,
  /\bwhat(?:'s| is) .* like\b/i,
  /\bis [a-z].* (safe|expensive|good)\b/i,
];

export function detectDestinationKnowledgeIntent(question: string): boolean {
  const text = question.trim();
  if (!text) return false;
  if (KNOWLEDGE_CUES.some((re) => re.test(text))) return true;
  // Destination mention + question mark / inquisitive verbs
  const mentions = detectDestinationMentions(text);
  if (mentions.length && /\?|\b(how|what|is|are|can|should|does)\b/i.test(text)) {
    return true;
  }
  return false;
}

export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (!chunks.length) {
    return "No destination knowledge chunks retrieved.";
  }
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.destinationName} · ${c.topic} · ${c.title}\n${c.content}`,
    )
    .join("\n\n");
}

/**
 * RAG retrieve: embed query → hybrid vector/lexical search over destination knowledge.
 */
export async function retrieveDestinationKnowledge(input: {
  question: string;
  destinationSlugs?: string[];
  topK?: number;
  signal?: AbortSignal;
}): Promise<DestinationKnowledgeResult> {
  const topics = detectKnowledgeTopics(input.question);
  const mentioned = detectDestinationMentions(input.question);
  const slugs = input.destinationSlugs?.length
    ? input.destinationSlugs
    : mentioned;

  // For compares, ensure we pull chunks from each side.
  const topK = input.topK ?? (slugs.length > 1 ? 8 : 6);
  const scored = await similaritySearch({
    query: input.question,
    topK: topK * 2,
    destinationSlugs: slugs.length ? slugs : undefined,
    signal: input.signal,
  });

  // Prefer topic-aligned chunks when detected.
  const topicBoosted = [...scored].sort((a, b) => {
    const aHit = topics.includes(a.topic) ? 1 : 0;
    const bHit = topics.includes(b.topic) ? 1 : 0;
    if (aHit !== bHit) return bHit - aHit;
    return b.score - a.score;
  });

  const chunks: RetrievedChunk[] = topicBoosted.slice(0, topK).map((c) => ({
    id: c.id,
    destinationSlug: c.destinationSlug,
    destinationName: c.destinationName,
    country: c.country,
    topic: c.topic,
    title: c.title,
    content: c.content,
    score: c.score,
  }));

  return {
    question: input.question,
    destinations: slugs,
    topics,
    chunks,
    contextText: formatRetrievedContext(chunks),
  };
}
