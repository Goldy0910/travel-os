import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const metaName = user.user_metadata?.full_name;
  const initialName =
    (typeof profile?.name === "string" && profile.name.trim()) ||
    (typeof metaName === "string" && metaName.trim()) ||
    user.email?.split("@")[0] ||
    "";

  const initialAvatarUrl =
    typeof profile?.avatar_url === "string" && profile.avatar_url.trim()
      ? profile.avatar_url.trim()
      : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <SettingsClient
        userId={user.id}
        email={user.email ?? ""}
        initialName={initialName}
        initialAvatarUrl={initialAvatarUrl}
      />
    </main>
  );
}
