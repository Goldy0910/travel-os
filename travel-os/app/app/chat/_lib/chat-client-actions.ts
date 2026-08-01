export type ReactionEmoji = "👍" | "❤️" | "😂" | "😮" | "🙏";

export const REACTION_OPTIONS: ReactionEmoji[] = ["👍", "❤️", "😂", "😮", "🙏"];

const REACTIONS_STORAGE_PREFIX = "travel-os:chat-reactions:";

function reactionStorageKey(conversationId: string, messageId: string) {
  return `${REACTIONS_STORAGE_PREFIX}${conversationId}:${messageId}`;
}

export function loadMessageReactions(
  conversationId: string | null | undefined,
  messageId: string,
): ReactionEmoji[] {
  if (typeof window === "undefined" || !conversationId || !messageId) return [];
  try {
    const raw = window.localStorage.getItem(reactionStorageKey(conversationId, messageId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is ReactionEmoji =>
      REACTION_OPTIONS.includes(r as ReactionEmoji),
    );
  } catch {
    return [];
  }
}

export function saveMessageReactions(
  conversationId: string,
  messageId: string,
  reactions: ReactionEmoji[],
) {
  if (typeof window === "undefined" || !conversationId || !messageId) return;
  try {
    const key = reactionStorageKey(conversationId, messageId);
    if (reactions.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(reactions));
  } catch {
    // ignore quota / private mode
  }
}

export function toggleReaction(
  current: ReactionEmoji[],
  emoji: ReactionEmoji,
): ReactionEmoji[] {
  return current.includes(emoji)
    ? current.filter((r) => r !== emoji)
    : [...current, emoji];
}

export type ExportableMessage = {
  role: string;
  content: string;
  created_at?: string;
};

export function conversationToMarkdown(
  title: string,
  messages: ExportableMessage[],
): string {
  const lines = [`# ${title.trim() || "Conversation"}`, ""];
  for (const message of messages) {
    const label =
      message.role === "user"
        ? "You"
        : message.role === "assistant"
          ? "Assistant"
          : message.role;
    lines.push(`## ${label}`);
    if (message.created_at) {
      lines.push(`_${message.created_at}_`);
      lines.push("");
    }
    lines.push(message.content.trim() || "_(empty)_");
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export function conversationToJson(
  title: string,
  messages: ExportableMessage[],
  conversationId?: string | null,
): string {
  return `${JSON.stringify(
    {
      title: title.trim() || "Conversation",
      conversationId: conversationId ?? null,
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at ?? null,
      })),
    },
    null,
    2,
  )}\n`;
}

export function conversationPlainText(
  title: string,
  messages: ExportableMessage[],
): string {
  const parts = [title.trim() || "Conversation", ""];
  for (const message of messages) {
    const label =
      message.role === "user"
        ? "You"
        : message.role === "assistant"
          ? "Assistant"
          : message.role;
    parts.push(`${label}:`);
    parts.push(message.content.trim() || "(empty)");
    parts.push("");
  }
  return parts.join("\n").trim();
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugifyFilename(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "conversation";
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export async function shareConversationText(
  title: string,
  text: string,
): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, text });
      return "shared";
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return "failed";
    // fall through to clipboard
  }
  const ok = await copyTextToClipboard(text);
  return ok ? "copied" : "failed";
}
