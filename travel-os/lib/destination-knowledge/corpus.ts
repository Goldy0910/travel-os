import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import { topicKnowledgeBySlug } from "@/lib/destination-knowledge/topics";
import type { KnowledgeChunk, KnowledgeTopic } from "@/lib/destination-knowledge/types";

function chunk(
  dest: { slug: string; name: string; country: string },
  topic: KnowledgeTopic,
  title: string,
  content: string,
): KnowledgeChunk {
  return {
    id: `${dest.slug}:${topic}:${title.toLowerCase().replace(/\s+/g, "-").slice(0, 40)}`,
    destinationSlug: dest.slug,
    destinationName: dest.name,
    country: dest.country,
    topic,
    title,
    content: content.trim(),
  };
}

/** Build the Destination Knowledge corpus (documents for RAG). */
export function buildKnowledgeCorpus(): KnowledgeChunk[] {
  const overlays = topicKnowledgeBySlug();
  const chunks: KnowledgeChunk[] = [];

  for (const dest of DESTINATION_CATALOG) {
    const base = { slug: dest.slug, name: dest.name, country: dest.country };
    const overlay = overlays.get(dest.slug);

    chunks.push(
      chunk(
        base,
        "overview",
        `${dest.name} overview`,
        `${dest.name}, ${dest.country}. ${dest.shortDescription} ${dest.overview} Travel style: ${dest.travelStyle}. Ideal duration: ${dest.idealDuration}. Highlights: ${dest.topAttractions.join(", ")}.`,
      ),
    );

    chunks.push(
      chunk(
        base,
        "cost",
        `${dest.name} cost`,
        overlay?.cost ??
          `${dest.name} estimated trip budgets commonly fall around INR ${dest.estimatedBudgetInr.min.toLocaleString("en-IN")}–${dest.estimatedBudgetInr.max.toLocaleString("en-IN")} depending on style and season. ${dest.whyItMatches}`,
      ),
    );

    chunks.push(
      chunk(
        base,
        "weather",
        `${dest.name} weather`,
        `${dest.weatherSummary} Best months often include: ${dest.bestMonths.join(", ")}.`,
      ),
    );

    chunks.push(
      chunk(
        base,
        "food",
        `${dest.name} food`,
        overlay?.food ??
          `Food highlights in ${dest.name}: ${dest.foodHighlights.join(", ")}.`,
      ),
    );

    chunks.push(
      chunk(
        base,
        "transport",
        `${dest.name} transport`,
        overlay?.transport ?? dest.transportNotes,
      ),
    );

    chunks.push(
      chunk(
        base,
        "safety",
        `${dest.name} safety`,
        overlay?.solo
          ? `${dest.safetyNotes} Solo travel notes: ${overlay.solo}`
          : dest.safetyNotes,
      ),
    );

    if (overlay?.solo) {
      chunks.push(chunk(base, "solo", `${dest.name} solo travel`, overlay.solo));
    }
    if (overlay?.internet) {
      chunks.push(chunk(base, "internet", `${dest.name} internet`, overlay.internet));
    }
    if (overlay?.nightlife) {
      chunks.push(chunk(base, "nightlife", `${dest.name} nightlife`, overlay.nightlife));
    }
    if (overlay?.family) {
      chunks.push(chunk(base, "family", `${dest.name} family travel`, overlay.family));
    }

    chunks.push(
      chunk(
        base,
        "visa",
        `${dest.name} entry notes`,
        dest.region === "india"
          ? `${dest.name} is domestic for Indian travellers — no international visa required.`
          : `${dest.name} (${dest.country}) is international for Indian travellers — check current visa/VOA/e-visa rules before booking. Tip: ${dest.travelTips[0] ?? "Verify entry requirements close to travel dates."}`,
      ),
    );

    // Compare-oriented summary chunk
    chunks.push(
      chunk(
        base,
        "compare",
        `${dest.name} comparison profile`,
        [
          `${dest.name}, ${dest.country} (${dest.region}).`,
          `Budget band INR ${dest.estimatedBudgetInr.min}–${dest.estimatedBudgetInr.max}.`,
          `Weather: ${dest.weatherSummary}`,
          `Food: ${(overlay?.food ?? dest.foodHighlights.join(", ")).slice(0, 220)}`,
          `Transport: ${(overlay?.transport ?? dest.transportNotes).slice(0, 220)}`,
          `Nightlife: ${(overlay?.nightlife ?? "Moderate / varies").slice(0, 180)}`,
          `Family: ${(overlay?.family ?? "Varies by area").slice(0, 180)}`,
          `Solo: ${(overlay?.solo ?? dest.safetyNotes).slice(0, 180)}`,
          `Internet: ${(overlay?.internet ?? "Typical tourist connectivity").slice(0, 160)}`,
        ].join(" "),
      ),
    );
  }

  return chunks;
}
