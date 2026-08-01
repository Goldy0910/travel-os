import { redirect } from "next/navigation";

type ChatPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Legacy `/app/chat` → home landing chat (preserves `?c=` conversation deep links).
 */
export default async function ChatPage({ searchParams }: ChatPageProps) {
  const params = (await searchParams) ?? {};
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) sp.set(key, value);
    else if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
      sp.set(key, value[0]);
    }
  }
  const qs = sp.toString();
  redirect(qs ? `/app/home?${qs}` : "/app/home");
}
