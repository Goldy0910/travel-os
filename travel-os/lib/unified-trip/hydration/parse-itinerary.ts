import type { MasterItineraryDay } from "@/lib/master-trip-file/types";
import type { ParsedActivitySegment, ParsedItinerarySegment } from "./types";

const DAY_LINE_RE = /^Day\s*(\d+)\s*:\s*(.*)$/i;
const TIME_PREFIX_RE =
  /^(morning|afternoon|evening|night|breakfast|lunch|dinner|early\s+morning)\s*[:\-–—]\s*/i;
const BULLET_SPLIT_RE = /\s*(?:;|•|\||\n)\s*/;

/**
 * Parses homepage / master-file itinerary lines ("Day 1: …") into structured segments.
 */
export function parseMasterItineraryDay(day: MasterItineraryDay): ParsedItinerarySegment {
  const summary = day.summary.trim();
  const segments = splitSummaryIntoActivitySegments(summary, day.title);
  return {
    dayNumber: day.dayNumber,
    dayTitle: day.title.trim() || `Day ${day.dayNumber}`,
    summary,
    segments: segments.length > 0 ? segments : [fallbackSegmentFromSummary(summary, day.title)],
  };
}

export function parseItineraryStringLine(line: string, index: number): ParsedItinerarySegment {
  const trimmed = line.trim();
  const dayMatch = DAY_LINE_RE.exec(trimmed);
  const dayNumber = dayMatch ? Number.parseInt(dayMatch[1], 10) : index + 1;
  const summary = dayMatch?.[2]?.trim() || trimmed;
  const dayTitle = `Day ${dayNumber}`;
  const segments = splitSummaryIntoActivitySegments(summary, dayTitle);
  return {
    dayNumber,
    dayTitle,
    summary,
    segments: segments.length > 0 ? segments : [fallbackSegmentFromSummary(summary, dayTitle)],
  };
}

export function splitSummaryIntoActivitySegments(
  summary: string,
  dayTitle: string,
): ParsedActivitySegment[] {
  const raw = summary.trim();
  if (!raw) return [];

  const parts = raw
    .split(BULLET_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    const timeSplit = splitByTimePrefixes(raw);
    if (timeSplit.length > 1) return timeSplit;
    return [segmentFromChunk(raw, dayTitle)];
  }

  return parts.map((chunk) => segmentFromChunk(chunk, dayTitle));
}

function splitByTimePrefixes(text: string): ParsedActivitySegment[] {
  const pattern =
    /(morning|afternoon|evening|night|breakfast|lunch|dinner|early morning)\s*[:\-–—]\s*/gi;
  const indices: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    indices.push(match.index);
  }
  if (indices.length < 2) return [];

  const chunks: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = indices[i + 1] ?? text.length;
    chunks.push(text.slice(start, end).trim());
  }
  return chunks.map((chunk) => segmentFromChunk(chunk, "Activity"));
}

function segmentFromChunk(chunk: string, fallbackTitle: string): ParsedActivitySegment {
  const timeMatch = TIME_PREFIX_RE.exec(chunk);
  const timeHint = timeMatch?.[1]?.toLowerCase().replace(/\s+/g, " ") ?? undefined;
  const body = timeMatch ? chunk.slice(timeMatch[0].length).trim() : chunk;

  const title = simplifyActivityTitle(body || fallbackTitle);
  return {
    title,
    description: body || chunk,
    timeHint,
    categoryHint: inferCategoryHint(title + " " + body),
  };
}

function fallbackSegmentFromSummary(summary: string, dayTitle: string): ParsedActivitySegment {
  return segmentFromChunk(summary, dayTitle);
}

function simplifyActivityTitle(raw: string): string {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return "Activity";
  const [firstClause] = normalized.split(/\s[—\-|]\s|:\s+/);
  const base = (firstClause || normalized).trim();
  const compact = base.replace(/[.!,;:]+$/g, "").trim();
  if (compact.length <= 56) return compact;
  return `${compact.slice(0, 53).trimEnd()}...`;
}

function inferCategoryHint(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/beach|coast|sea|surf/.test(t)) return "beach";
  if (/temple|fort|museum|heritage|palace|church|mosque/.test(t)) return "culture";
  if (/restaurant|cafe|food|dining|street food|breakfast|lunch|dinner/.test(t)) return "food";
  if (/market|bazaar|shop/.test(t)) return "shopping";
  if (/hike|trek|adventure|water sport|snorkel|dive/.test(t)) return "adventure";
  if (/relax|spa|sunset|leisure/.test(t)) return "relaxation";
  if (/hotel|check-?in|check-?out|airport|transfer/.test(t)) return "logistics";
  return "sightseeing";
}
