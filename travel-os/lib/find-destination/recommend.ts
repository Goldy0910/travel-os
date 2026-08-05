import { DESTINATION_CATALOG } from "@/lib/find-destination/catalog";
import { GEMINI_GENERATE_MODELS } from "@/lib/ai/gemini-models";
import type {
  DestinationRecommendation,
  QuizAnswers,
  RecommendationResponse,
} from "@/app/find-destination/_lib/types";
import {
  buildExpertRecommendation,
  isExpertRecommendationModeEnabled,
  scoreDestinationExpert,
  signalsFromQuizAnswers,
} from "@/lib/chat/expert-recommendation";

function scoreDestination(dest: DestinationRecommendation, answers: QuizAnswers): number {
  if (isExpertRecommendationModeEnabled()) {
    return scoreDestinationExpert(dest, signalsFromQuizAnswers(answers)).matchScore;
  }

  // Legacy heuristic (kept when expert mode is disabled via env).
  let score = 40;

  if (answers.region === "india" && dest.region === "india") score += 18;
  if (answers.region === "international" && dest.region === "international") score += 18;
  if (answers.region === "surprise") score += 8;

  const budget = answers.budgetInr;
  const mid = (dest.estimatedBudgetInr.min + dest.estimatedBudgetInr.max) / 2;
  const budgetDelta = Math.abs(mid - budget) / Math.max(budget, 1);
  score += Math.max(0, 16 - budgetDelta * 20);

  const days =
    answers.duration === "weekend"
      ? 2
      : answers.duration === "3-5-days"
        ? 4
        : answers.duration === "1-week"
          ? 7
          : answers.duration === "2-weeks"
            ? 14
            : 18;
  if (days <= 5 && dest.idealDuration.includes("3")) score += 6;
  if (days >= 6 && days <= 10 && (dest.idealDuration.includes("6") || dest.idealDuration.includes("7") || dest.idealDuration.includes("5")))
    score += 6;
  if (days >= 11) score += 4;

  const weatherMap: Record<string, string[]> = {
    snow: ["manali", "leh"],
    cold: ["manali", "leh", "paris", "tokyo"],
    pleasant: ["jaipur", "udaipur", "paris", "tokyo", "rishikesh"],
    warm: ["goa", "dubai", "bangkok", "singapore", "bali", "kerala"],
    beach: ["goa", "andaman", "bali", "maldives", "bangkok"],
    any: [],
  };
  const weatherHits = weatherMap[answers.weather] ?? [];
  if (answers.weather === "any" || weatherHits.some((h) => dest.slug.includes(h))) score += 10;

  const interestTags: Record<string, string[]> = {
    beaches: ["beach", "island", "coast", "reef", "surf"],
    mountains: ["mountain", "alpine", "himalaya", "valley", "altitude"],
    adventure: ["adventure", "rafting", "active", "road"],
    wildlife: ["wildlife", "marine", "reef", "snorkel"],
    food: ["food", "cafe", "cuisine", "hawker", "seafood"],
    nightlife: ["night", "nightlife", "energy"],
    shopping: ["shopping", "bazaar", "market", "mall"],
    history: ["history", "heritage", "fort", "palace", "temple", "museum"],
    spiritual: ["spiritual", "yoga", "temple", "ashram", "monastery"],
    photography: ["photography", "photogenic", "cinematic", "iconic"],
    "road-trips": ["road", "drive", "scenic"],
    "hidden-gems": ["quiet", "hidden", "unhurried"],
    luxury: ["luxury", "polished", "overwater", "spa"],
    relaxation: ["relax", "unwind", "calm", "slow", "wellness"],
  };

  const blob = `${dest.shortDescription} ${dest.overview} ${dest.travelStyle} ${dest.topAttractions.join(" ")}`.toLowerCase();
  for (const interest of answers.interests) {
    const keys = interestTags[interest] ?? [interest];
    if (keys.some((k) => blob.includes(k) || dest.slug.includes(k))) score += 3.5;
  }

  const style = answers.travelStyle;
  const styleBlob = dest.travelStyle.toLowerCase();
  if (style === "relaxing" && styleBlob.includes("relax")) score += 8;
  if (style === "active" && styleBlob.includes("active")) score += 8;
  if (style === "moderate" && (styleBlob.includes("moderate") || styleBlob.includes("relax") || styleBlob.includes("active")))
    score += 5;

  if (answers.companion === "couple" && (dest.slug.includes("udaipur") || dest.slug.includes("maldives") || dest.slug.includes("paris") || dest.slug.includes("bali")))
    score += 6;
  if (answers.companion === "family" && (dest.slug.includes("singapore") || dest.slug.includes("dubai") || dest.slug.includes("jaipur")))
    score += 5;
  if (answers.companion === "friends" && (dest.slug.includes("goa") || dest.slug.includes("bangkok") || dest.slug.includes("bali")))
    score += 5;
  if (answers.companion === "solo" && (dest.slug.includes("rishikesh") || dest.slug.includes("tokyo") || dest.slug.includes("bali")))
    score += 4;

  if (answers.transport === "road" && blob.includes("road")) score += 4;
  if (answers.transport === "flights" && dest.region === "international") score += 3;
  if (answers.transport === "train" && dest.region === "india") score += 3;

  return Math.max(55, Math.min(98, Math.round(score)));
}

function refineWhy(dest: DestinationRecommendation, answers: QuizAnswers, score: number): string {
  const bits: string[] = [];
  if (answers.interests.length) {
    bits.push(`Matches your interests around ${answers.interests.slice(0, 3).join(", ").replace(/-/g, " ")}`);
  }
  bits.push(`Fits a ~${formatBudget(answers.budgetInr)} trip`);
  if (answers.region !== "surprise") {
    bits.push(answers.region === "india" ? "Stays within India" : "Leans international");
  }
  return `${dest.whyItMatches} ${bits.join(". ")}. Confidence ${score}%.`;
}

function formatBudget(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function recommendDestinationsMock(answers: QuizAnswers): RecommendationResponse {
  if (isExpertRecommendationModeEnabled()) {
    const expert = buildExpertRecommendation({
      signals: signalsFromQuizAnswers(answers),
      limit: 3,
    });
    if (expert) {
      const ranked = [expert.primary, ...expert.alternatives]
        .map((row) => {
          const catalog = DESTINATION_CATALOG.find((d) => d.slug === row.slug);
          if (!catalog) return null;
          return {
            ...catalog,
            confidenceScore: row.matchScore,
            whyItMatches:
              row.role === "primary"
                ? `${row.whyReasons[0] ?? catalog.whyItMatches} ${expert.expertOpinion}`
                : `${row.rankedLowerReasons[0] ?? catalog.whyItMatches}`,
            shortDescription: row.summary || catalog.shortDescription,
          };
        })
        .filter((d): d is DestinationRecommendation => d != null);

      if (ranked.length > 0) {
        return {
          destinations: ranked,
          generatedAt: new Date().toISOString(),
          source: "mock",
        };
      }
    }
  }

  const ranked = DESTINATION_CATALOG.map((dest) => {
    const confidenceScore = scoreDestination(dest, answers);
    return {
      ...dest,
      confidenceScore,
      whyItMatches: refineWhy(dest, answers, confidenceScore),
    };
  })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3);

  return {
    destinations: ranked,
    generatedAt: new Date().toISOString(),
    source: "mock",
  };
}

function extractJsonObject(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Invalid AI response");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}

function normalizeAiDestinations(raw: unknown, answers: QuizAnswers): DestinationRecommendation[] {
  if (!raw || typeof raw !== "object") throw new Error("Empty AI response");
  const obj = raw as { destinations?: unknown };
  if (!Array.isArray(obj.destinations) || obj.destinations.length === 0) {
    throw new Error("Empty AI response");
  }

  const out: DestinationRecommendation[] = [];
  for (const item of obj.destinations.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const country = typeof row.country === "string" ? row.country.trim() : "Worldwide";
    const slugHint = typeof row.slug === "string" ? row.slug : "";
    const catalogHit =
      DESTINATION_CATALOG.find((d) => d.slug === slugHint) ||
      DESTINATION_CATALOG.find((d) => d.name.toLowerCase() === name.toLowerCase()) ||
      null;

    if (catalogHit) {
      const confidence =
        typeof row.confidenceScore === "number"
          ? Math.max(60, Math.min(99, Math.round(row.confidenceScore)))
          : scoreDestination(catalogHit, answers);
      out.push({
        ...catalogHit,
        confidenceScore: confidence,
        whyItMatches:
          typeof row.whyItMatches === "string" && row.whyItMatches.trim()
            ? row.whyItMatches.trim()
            : catalogHit.whyItMatches,
        shortDescription:
          typeof row.shortDescription === "string" && row.shortDescription.trim()
            ? row.shortDescription.trim()
            : catalogHit.shortDescription,
      });
      continue;
    }

    // Fallback: build a lightweight card without catalog match
    const slug =
      slugHint ||
      `${name}-${country}`
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
    out.push({
      slug,
      name,
      country,
      region: answers.region === "india" ? "india" : "international",
      shortDescription:
        typeof row.shortDescription === "string" ? row.shortDescription : "A strong match for your preferences.",
      overview: typeof row.overview === "string" ? row.overview : "",
      whyItMatches: typeof row.whyItMatches === "string" ? row.whyItMatches : "Selected from your quiz answers.",
      bestMonths: Array.isArray(row.bestMonths) ? row.bestMonths.map(String).slice(0, 6) : ["Nov", "Dec", "Jan"],
      estimatedBudgetInr: {
        min: Number((row.estimatedBudgetInr as { min?: number } | undefined)?.min) || answers.budgetInr * 0.7,
        max: Number((row.estimatedBudgetInr as { max?: number } | undefined)?.max) || answers.budgetInr * 1.2,
      },
      idealDuration: typeof row.idealDuration === "string" ? row.idealDuration : "5–7 days",
      topAttractions: Array.isArray(row.topAttractions) ? row.topAttractions.map(String).slice(0, 5) : [],
      travelStyle: typeof row.travelStyle === "string" ? row.travelStyle : answers.travelStyle,
      confidenceScore:
        typeof row.confidenceScore === "number" ? Math.max(60, Math.min(99, Math.round(row.confidenceScore))) : 80,
      imageSearchKeyword: typeof row.imageSearchKeyword === "string" ? row.imageSearchKeyword : name,
      imageUrl:
        "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
      weatherSummary: typeof row.weatherSummary === "string" ? row.weatherSummary : "Varies by season.",
      foodHighlights: Array.isArray(row.foodHighlights) ? row.foodHighlights.map(String) : [],
      transportNotes: typeof row.transportNotes === "string" ? row.transportNotes : "Flights are typically easiest.",
      packingTips: Array.isArray(row.packingTips) ? row.packingTips.map(String) : [],
      travelTips: Array.isArray(row.travelTips) ? row.travelTips.map(String) : [],
      safetyNotes: typeof row.safetyNotes === "string" ? row.safetyNotes : "Follow usual travel precautions.",
    });
  }

  if (out.length === 0) throw new Error("Invalid AI response");
  while (out.length < 3) {
    const filler = DESTINATION_CATALOG.find((d) => !out.some((o) => o.slug === d.slug));
    if (!filler) break;
    out.push({ ...filler, confidenceScore: Math.max(70, filler.confidenceScore - 10) });
  }
  return out.slice(0, 3);
}

async function recommendWithGemini(answers: QuizAnswers): Promise<RecommendationResponse> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const catalogBrief = DESTINATION_CATALOG.map((d) => ({
    slug: d.slug,
    name: d.name,
    country: d.country,
    region: d.region,
    budget: d.estimatedBudgetInr,
    style: d.travelStyle,
    tags: d.topAttractions.slice(0, 3),
  }));

  const systemPrompt = isExpertRecommendationModeEnabled()
    ? `You are an expert travel advisor for Indian travelers. Return ONLY valid JSON with key destinations (array of exactly 3, ranked best-first). Prefer slugs from the provided catalog.
The first item MUST be your single best recommendation. Scores must be unique integers 60–99 (no ties).
Each item needs: slug, name, country, shortDescription, whyItMatches (personalized to the quiz answers — reference budget, duration, weather, interests, companion), confidenceScore.
Act confident: do not hedge with "all are good".`
    : "You are a travel destination recommender. Return ONLY valid JSON with key destinations (array of 3). Prefer slugs from the provided catalog. Each item needs: slug, name, country, shortDescription, whyItMatches, confidenceScore (60-99).";

  const userPrompt = JSON.stringify({ answers, catalog: catalogBrief }, null, 0);
  let last = "AI response unavailable";

  for (const model of GEMINI_GENERATE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.35, maxOutputTokens: 2000 },
          }),
          signal: controller.signal,
        },
      );
      const data = (await response.json().catch(() => null)) as
        | {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            error?: { message?: string };
          }
        | null;
      if (!response.ok) {
        last = data?.error?.message?.trim() || `Gemini HTTP ${response.status}`;
        continue;
      }
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!raw) {
        last = "Empty AI response";
        continue;
      }
      const parsed = extractJsonObject(raw);
      const destinations = normalizeAiDestinations(parsed, answers);
      return { destinations, generatedAt: new Date().toISOString(), source: "gemini" };
    } catch (error) {
      last = error instanceof Error ? error.message : "AI timeout";
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last);
}

/**
 * Reusable destination recommender. Tries Gemini when configured, otherwise mock catalog scoring.
 * Swap implementations here without touching UI.
 */
export async function recommendDestinations(answers: QuizAnswers): Promise<RecommendationResponse> {
  if (process.env.GEMINI_API_KEY?.trim()) {
    try {
      return await recommendWithGemini(answers);
    } catch {
      return recommendDestinationsMock(answers);
    }
  }
  return recommendDestinationsMock(answers);
}
