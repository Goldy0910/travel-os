import type { PhraseCategory } from "./types";
import { chinesePhrasebook } from "./languages/chinese";
import { frenchPhrasebook } from "./languages/french";
import { germanPhrasebook } from "./languages/german";
import { hindiPhrasebook } from "./languages/hindi";
import { japanesePhrasebook } from "./languages/japanese";
import { koreanPhrasebook } from "./languages/korean";
import { malayalamPhrasebook } from "./languages/malayalam";
import { odiaPhrasebook } from "./languages/odia";
import { spanishPhrasebook } from "./languages/spanish";
import { tamilPhrasebook } from "./languages/tamil";
import { teluguPhrasebook } from "./languages/telugu";

export type { PhraseCategory, PhraseRow } from "./types";

/** Curated phrasebooks shipped with the app — no Gemini call. Keys match `detectLanguage()` labels. */
const BUNDLES: Record<string, PhraseCategory[]> = {
  Hindi: hindiPhrasebook,
  Japanese: japanesePhrasebook,
  Korean: koreanPhrasebook,
  Spanish: spanishPhrasebook,
  French: frenchPhrasebook,
  Chinese: chinesePhrasebook,
  German: germanPhrasebook,
  Telugu: teluguPhrasebook,
  Tamil: tamilPhrasebook,
  Malayalam: malayalamPhrasebook,
  Odia: odiaPhrasebook,
};

function cloneCategories(cats: PhraseCategory[]): PhraseCategory[] {
  return JSON.parse(JSON.stringify(cats)) as PhraseCategory[];
}

/**
 * Returns a deep-cloned static phrasebook for the given UI language label, or null to fall back to AI.
 */
export function getStaticPhrasebook(language: string): PhraseCategory[] | null {
  const key = language.trim();
  const bundle = BUNDLES[key];
  if (!bundle) return null;
  return cloneCategories(bundle);
}

export function hasStaticPhrasebook(language: string): boolean {
  return Boolean(BUNDLES[language.trim()]);
}
