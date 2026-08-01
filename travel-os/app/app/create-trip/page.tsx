import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { pickSearchParam } from "@/app/app/_lib/search-params";
import { getDestinationBySlug } from "@/lib/find-destination/catalog";
import { redirect } from "next/navigation";
import CreateTripForm from "./create-trip-form";
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
  const placeHint = pickSearchParam(params, "place");
  const destinationHint = pickSearchParam(params, "destination");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  let user = authUser;
  if (!user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    user = session?.user ?? null;
  }
  if (!user) {
    const nextQs = new URLSearchParams();
    if (placeHint) nextQs.set("place", placeHint);
    if (destinationHint) nextQs.set("destination", destinationHint);
    const qs = nextQs.toString();
    redirect(`/app/login?next=${encodeURIComponent(`/app/create-trip${qs ? `?${qs}` : ""}`)}`);
  }

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

  const catalogDest = placeHint ? getDestinationBySlug(placeHint) : null;
  const matchedPlace =
    travelPlaces.find((p) => p.slug === placeHint) ||
    travelPlaces.find((p) => catalogDest && p.slug === catalogDest.travelPlaceSlug) ||
    travelPlaces.find(
      (p) =>
        catalogDest &&
        p.primary_label.toLowerCase() === catalogDest.name.toLowerCase(),
    ) ||
    travelPlaces.find(
      (p) =>
        destinationHint &&
        p.canonical_location.toLowerCase().includes(destinationHint.toLowerCase()),
    ) ||
    null;

  const initialPlaceSlug = matchedPlace?.slug ?? null;
  const initialQuery =
    matchedPlace?.canonical_location ||
    (catalogDest ? `${catalogDest.name}, ${catalogDest.country}` : "") ||
    destinationHint ||
    "";

  return (
    <>
      <SetAppHeader title="Create trip" showBack />
      <main className="box-border min-h-full min-w-0 max-w-full overflow-x-hidden bg-slate-50 px-4 py-6 pb-[calc(var(--travel-os-bottom-nav-h)+7rem)]">
        <div className="travel-os-content min-w-0 space-y-4 md:px-4">
        <div className="box-border min-w-0 max-w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-6">
            <p className="text-sm text-slate-500">New Trip</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create trip</h1>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          {travelPlaces.length === 0 ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Destinations list is unavailable. Apply the latest database migration (travel_places), then
              refresh.
            </p>
          ) : null}

          <CreateTripForm
            places={travelPlaces}
            destinationsLoaded={travelPlaces.length > 0}
            initialPlaceSlug={initialPlaceSlug}
            initialQuery={initialQuery}
          />
        </div>
        </div>
      </main>
    </>
  );
}
