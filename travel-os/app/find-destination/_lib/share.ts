export function buildShareText(destinationName: string): string {
  return `I got ${destinationName} as my perfect travel destination 🌴\n\nFind yours on Travel OS → ${typeof window !== "undefined" ? `${window.location.origin}/find-destination` : "/find-destination"}`;
}

export async function shareDestination(destinationName: string, url: string): Promise<"shared" | "copied" | "failed"> {
  const text = buildShareText(destinationName);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: `${destinationName} · Travel OS`, text, url });
      return "shared";
    }
  } catch {
    /* fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
