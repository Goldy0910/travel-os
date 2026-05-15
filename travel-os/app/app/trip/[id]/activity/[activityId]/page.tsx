import Link from "next/link";
import { redirect } from "next/navigation";
import { SetAppHeader } from "@/components/AppHeader";
import {
  getCachedNearbyPlaces,
  getCachedPlaceDetails,
  getCachedSearchPlaceId,
  type NearbyPlace,
  type PlaceInfo,
} from "@/lib/activity-place-details-cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isMissingItineraryMetadataColumn } from "@/lib/supabase-schema-errors";
import { isTripMember } from "@/lib/trip-membership";
import ActivityPhotoGallery from "./_components/activity-photo-gallery";
import ActivityReviews from "./_components/activity-reviews";

type Props = {
  params: Promise<{ id: string; activityId: string }>;
};

function pickFirstString(record: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return fallback;
}

function dayChipForDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function titleClassForText(title: string): string {
  const len = title.trim().length;
  if (len > 80) return "text-[1.45rem] leading-[1.2]";
  if (len > 48) return "text-[1.65rem] leading-[1.2]";
  return "text-[1.95rem] leading-[1.15]";
}

export default async function ActivityDetailsPage({ params }: Props) {
  const { id: tripId, activityId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const member = await isTripMember(supabase, tripId, user.id);
  if (!member) redirect("/app/home");

  const { data: tripData } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();
  if (!tripData) redirect("/app/home");

  let itemData: Record<string, unknown> | null = null;
  const extendedSelect = await supabase
    .from("itinerary_items")
    .select("id, activity_name, title, location, time, date, notes, google_place_id")
    .eq("trip_id", tripId)
    .eq("id", activityId)
    .maybeSingle();

  if (extendedSelect.error && isMissingItineraryMetadataColumn(extendedSelect.error)) {
    const base = await supabase
      .from("itinerary_items")
      .select("id, activity_name, title, location, time, date")
      .eq("trip_id", tripId)
      .eq("id", activityId)
      .maybeSingle();
    itemData = base.data as Record<string, unknown> | null;
  } else {
    itemData = extendedSelect.data as Record<string, unknown> | null;
  }

  if (!itemData) redirect(`/app/trip/${encodeURIComponent(tripId)}?tab=itinerary`);

  const item = itemData as {
    id: string | number;
    activity_name: string | null;
    title: string | null;
    location: string | null;
    time: string | null;
    date: string | null;
    notes?: string | null;
    google_place_id?: string | null;
  };
  const activityTitle = (item.activity_name || item.title || "Activity").trim();
  const location = (item.location || "").trim();
  const activityNotes = (item.notes ?? "").trim();
  const dayChip = dayChipForDate(item.date);

  let placeInfo: PlaceInfo | null = null;
  let nearbyPlaces: NearbyPlace[] = [];

  const storedPlaceId = (item.google_place_id ?? "").trim();
  const query = [activityTitle, location].filter(Boolean).join(", ");
  const placeId =
    storedPlaceId || (await getCachedSearchPlaceId(query));
  placeInfo = placeId ? await getCachedPlaceDetails(placeId) : null;
  nearbyPlaces = await getCachedNearbyPlaces(`${location || activityTitle} attractions`);

  const tripTitle = pickFirstString(tripData as Record<string, unknown>, ["title", "name", "trip_name"], "Trip");
  const titleClassName = titleClassForText(activityTitle);

  return (
    <>
      <SetAppHeader title="Activity details" showBack />
      <main className="mx-auto w-full max-w-md space-y-4 bg-slate-50 px-4 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)] pt-3">
        <Link
          href={`/app/trip/${encodeURIComponent(tripId)}?tab=itinerary`}
          className="inline-flex min-h-10 items-center text-sm font-semibold text-slate-700"
        >
          ← Back to itinerary
        </Link>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{tripTitle}</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className={`line-clamp-3 min-w-0 pr-2 font-bold tracking-tight text-slate-900 ${titleClassName}`}>
              {activityTitle}
            </h1>
            <div className="flex shrink-0 gap-2">
              {dayChip ? (
                <span className="rounded-full border border-orange-300 px-3 py-1 text-[11px] font-bold uppercase text-orange-600">
                  {dayChip}
                </span>
              ) : null}
              {item.time ? (
                <span className="rounded-full border border-orange-300 px-3 py-1 text-[11px] font-bold uppercase text-orange-600">
                  {item.time}
                </span>
              ) : null}
            </div>
          </div>

          {placeInfo?.address || location ? (
            <p className="mt-3 text-sm text-slate-600">{placeInfo?.address || location}</p>
          ) : null}
          {placeInfo?.rating ? (
            <p className="mt-2 text-sm font-semibold text-slate-800">
              ⭐ {placeInfo.rating.toFixed(1)} ({placeInfo.userRatingCount.toLocaleString()} reviews)
            </p>
          ) : null}
        </section>

        {placeInfo?.photos?.length ? (
          <ActivityPhotoGallery photos={placeInfo.photos} activityTitle={activityTitle} />
        ) : null}

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Details</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {placeInfo?.websiteUrl ? (
              <a
                href={placeInfo.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-[15px] font-semibold text-slate-900">Website</p>
                <p className="mt-1 text-sm font-semibold text-indigo-600">Visit website →</p>
              </a>
            ) : null}

            {placeInfo?.phone ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[15px] font-semibold text-slate-900">Phone</p>
                <p className="mt-1 truncate text-sm font-semibold text-emerald-600">{placeInfo.phone}</p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[15px] font-semibold text-slate-900">Ticket / Price</p>
              <p className="mt-1 text-sm text-slate-700">{placeInfo?.priceLevel || "Not available"}</p>
            </div>

            {placeInfo?.mapsUrl ? (
              <a
                href={placeInfo.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-[15px] font-semibold text-slate-900">Map</p>
                <p className="mt-1 text-sm font-semibold text-indigo-600">Open in Maps →</p>
              </a>
            ) : null}

            {placeInfo?.openingHours?.length ? (
              <div className="col-span-2 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[15px] font-semibold text-slate-900">Opening hours</p>
                <p className="mt-1 text-xs text-slate-500">
                  {placeInfo.openNow == null ? "Open status unavailable" : placeInfo.openNow ? "Open now" : "Closed now"}
                </p>
                <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {placeInfo.openingHours.map((row) => (
                    <p key={row} className="text-sm text-slate-700">
                      {row}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {activityNotes ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Trip notes</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{activityNotes}</p>
          </section>
        ) : null}

        {placeInfo?.summary ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">About</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{placeInfo.summary}</p>
          </section>
        ) : null}

        {placeInfo?.reviews?.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Reviews</h2>
            <ActivityReviews reviews={placeInfo.reviews} />
          </section>
        ) : null}

        {nearbyPlaces.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Nearby places</h2>
            <div className="mt-3 space-y-2.5">
              {nearbyPlaces.map((place) => (
                <a
                  key={place.id}
                  href={place.mapsUrl || undefined}
                  target={place.mapsUrl ? "_blank" : undefined}
                  rel={place.mapsUrl ? "noreferrer" : undefined}
                  className="block rounded-2xl border border-slate-200 bg-slate-50 p-3.5"
                >
                  <p className="text-sm font-semibold text-slate-900">{place.name}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{place.address}</p>
                  {place.rating ? (
                    <p className="mt-1 text-xs font-medium text-slate-700">
                      ⭐ {place.rating.toFixed(1)} ({place.userRatingCount.toLocaleString()})
                    </p>
                  ) : null}
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

