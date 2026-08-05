/** Detect when the user wants a full list instead of a single expert pick. */
export function wantsFullOptionsList(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return (
    /\b(show|list|give|tell)\s+(me\s+)?(all|every|more)\s+(the\s+)?(options?|destinations?|places?|picks?)\b/i.test(
      text,
    ) ||
    /\ball\s+(the\s+)?(options?|destinations?)\b/i.test(text) ||
    /\bdon'?t\s+(just\s+)?(pick|choose|recommend)\s+(one|for me)\b/i.test(text)
  );
}

/**
 * Extract an explicitly mentioned destination the user is asking about
 * (e.g. "What about Switzerland?" / "Is Bali good?").
 */
export function extractMentionedDestination(message: string): string | null {
  const text = message.trim();
  if (!text) return null;

  const patterns: Array<{ re: RegExp; group: number }> = [
    { re: /\bwhat about\s+([A-Z][A-Za-zÀ-ÿ .'-]{1,40})\b/i, group: 1 },
    { re: /\bhow about\s+([A-Z][A-Za-zÀ-ÿ .'-]{1,40})\b/i, group: 1 },
    { re: /\bis\s+([A-Z][A-Za-zÀ-ÿ .'-]{1,40})\s+(good|worth|better|safe|ok|okay)\b/i, group: 1 },
    { re: /\bshould i (?:go to|visit|pick|choose)\s+([A-Z][A-Za-zÀ-ÿ .'-]{1,40})\b/i, group: 1 },
    {
      re: /\bi (?:was )?(?:thinking(?: of| about)?|considering|leaning toward[s]?)\s+([A-Z][A-Za-zÀ-ÿ .'-]{1,40})\b/i,
      group: 1,
    },
  ];

  for (const { re, group } of patterns) {
    const m = re.exec(text);
    if (!m?.[group]) continue;
    const name = m[group].replace(/\s+/g, " ").trim();
    if (name && name.length >= 2 && name.length <= 50) return name;
  }
  return null;
}
