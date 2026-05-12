import { redirect } from "next/navigation";

/** Alias so `/settings` matches common expectations; app shell lives under `/app`. */
export default function SettingsAliasPage() {
  redirect("/app/settings");
}
