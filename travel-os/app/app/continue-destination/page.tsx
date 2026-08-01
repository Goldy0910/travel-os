import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function pick(query: Record<string, string | string[] | undefined>, key: string): string {
  const v = query[key];
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
  return "";
}

/**
 * Auth-gated bridge so login `?next=` stays under `/app/*` (existing postLoginPath rules),
 * then continues the public find-destination Save / Create Trip flows.
 */
export default async function ContinueDestinationPage({ searchParams }: PageProps) {
  const query = (await searchParams) ?? {};
  const action = pick(query, "action").toLowerCase();
  const slug = pick(query, "slug");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/app/continue-destination?action=${encodeURIComponent(action || "save")}&slug=${encodeURIComponent(slug)}`;
    redirect(`/app/login?next=${encodeURIComponent(next)}`);
  }

  if (!slug) {
    redirect("/find-destination");
  }

  if (action === "trip") {
    redirect(`/app/create-trip?place=${encodeURIComponent(slug)}`);
  }

  // save (default): land on details with a client hint to persist
  redirect(`/find-destination/${encodeURIComponent(slug)}?saved=1`);
}
