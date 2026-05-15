import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import CreateTripGate from "./create-trip-gate";
import { mergeTravelPlacesFromDb } from "./travel-places-fallback";
import type { TravelPlaceDTO } from "./travel-place-types";

type CreateTripPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateTripPage({ searchParams }: CreateTripPageProps) {
  const params = (await searchParams) ?? {};
  const errorParam = params.error;
  const error =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";

  const placeSlug = typeof params.place === "string" ? params.place : undefined;
  const placeQuery = typeof params.q === "string" ? params.q : undefined;
  const daysRaw = typeof params.days === "string" ? Number.parseInt(params.days, 10) : NaN;
  const tripDays = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : undefined;

  const supabase = await createSupabaseServerClient();
  const { data: placeRows } = await supabase
    .from("travel_places")
    .select("slug, primary_label, subtitle, visa_note, tags, icon_key, sort_order, canonical_location")
    .order("sort_order", { ascending: true });

  const travelPlaces: TravelPlaceDTO[] = mergeTravelPlacesFromDb(
    (placeRows ?? []).map((row) => ({
      slug: String(row.slug),
      primary_label: String(row.primary_label),
      subtitle: row.subtitle == null ? null : String(row.subtitle),
      visa_note: row.visa_note == null ? null : String(row.visa_note),
      tags: Array.isArray(row.tags) ? row.tags.map((t) => String(t)) : [],
      icon_key: String(row.icon_key),
      sort_order: Number(row.sort_order),
      canonical_location: String(row.canonical_location),
    })),
  );

  return (
    <>
      <SetAppHeader title="Create trip" showBack />
      <main className="box-border min-h-full min-w-0 max-w-full overflow-x-hidden bg-slate-50 px-4 py-6 pb-[calc(var(--travel-os-bottom-nav-h)+7rem)]">
        <div className="mx-auto w-full min-w-0 max-w-md space-y-4">
        <div className="box-border min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-6">
            <p className="text-sm text-slate-500">New Trip</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create trip</h1>
          </div>

          {travelPlaces.length === 0 ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Destinations list is unavailable. Apply the latest database migration (travel_places), then
              refresh.
            </p>
          ) : null}

          <CreateTripGate
            places={travelPlaces}
            destinationsLoaded={travelPlaces.length > 0}
            error={error}
            initialPrefill={{
              slug: placeSlug,
              query: placeQuery,
              days: tripDays,
            }}
          />
        </div>
        </div>
      </main>
    </>
  );
}
