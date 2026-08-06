import SavedPlacesList from "@/app/app/saved/_components/saved-places-list";
import { SetAppHeader } from "@/components/AppHeader";
import {
  isMissingSavedPlacesTable,
  rowToSavedPlace,
  type SavedPlaceRow,
} from "@/lib/saved-places/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Heart } from "lucide-react";
import { redirect } from "next/navigation";

export default async function SavedPlacesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const { data, error } = await supabase
    .from("saved_places")
    .select(
      "id, user_id, place_id, name, address, category, photo_name, photo_url, rating, maps_url, lat, lng, destination_id, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const migrationPending = isMissingSavedPlacesTable(error);
  const items =
    !error && data ? (data as SavedPlaceRow[]).map(rowToSavedPlace) : [];

  return (
    <>
      <SetAppHeader title="Saved" showBack={false} />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6">
        <header className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-rose-600">
            <Heart className="h-3.5 w-3.5 fill-current" aria-hidden />
            Saved places
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your saved spots</h1>
          <p className="text-sm text-slate-600">
            Places you hearted from chat, search, and place details — ready when you plan.
          </p>
        </header>

        {migrationPending ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Apply the <code className="font-mono text-xs">20260806_saved_places.sql</code> migration
            in Supabase to enable saved places.
          </p>
        ) : null}

        {!migrationPending && error ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            Couldn’t load saved places. Try again in a moment.
          </p>
        ) : null}

        {!migrationPending && !error ? <SavedPlacesList initialItems={items} /> : null}
      </div>
    </>
  );
}
