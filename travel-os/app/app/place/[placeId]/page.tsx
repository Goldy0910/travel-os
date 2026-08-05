import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SetAppHeader } from "@/components/AppHeader";
import DestinationInterestBadge from "@/components/destination-interest-badge";
import PlaceActions from "@/app/app/place/[placeId]/_components/place-actions";
import PlaceGallery from "@/app/app/place/[placeId]/_components/place-gallery";
import { formatDestinationInterestLabel } from "@/lib/destination-interest/format";
import { resolveTopLevelDestination } from "@/lib/destination-interest/resolve";
import { createDestinationInterestService } from "@/lib/destination-interest/server";
import { GoogleMapsService, buildPhotoUrl } from "@/lib/places/google-maps-service";
import { formatPlacesMapsError } from "@/lib/chat/gemini-errors";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ExternalLink, MapPin, Star } from "lucide-react";

type Props = {
  params: Promise<{ placeId: string }>;
};

export default async function PlaceDetailsPage({ params }: Props) {
  const { placeId: rawId } = await params;
  const placeId = decodeURIComponent(rawId).trim();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/app/login");

  const details = placeId ? await GoogleMapsService.getPlaceDetails(placeId) : null;
  const topLevelDestination = details
    ? resolveTopLevelDestination({
        name: details.name,
        type: "place",
        googleTypes: details.types ?? [],
      })
    : null;
  let interestLabel: string | null = null;
  let interestTravelers = 0;
  let interestMonth: number | undefined;
  if (details && topLevelDestination) {
    after(() => {
      void createDestinationInterestService()
        .then((service) => service.trackView(topLevelDestination.id, user.id))
        .catch(() => undefined);
    });
    try {
      const service = await createDestinationInterestService();
      const snapshot = await service.getInterest(topLevelDestination.id);
      interestTravelers = snapshot?.totalInterest ?? 0;
      interestMonth = snapshot?.month;
      interestLabel = formatDestinationInterestLabel(interestTravelers, interestMonth);
    } catch {
      interestLabel = null;
    }
  }

  if (!details) {
    return (
      <>
        <SetAppHeader title="Place" showBack />
        <main className="travel-os-content space-y-4 bg-slate-50 px-4 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)] pt-3 md:px-8">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <h1 className="text-lg font-semibold text-amber-950">Google Maps place details</h1>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              {formatPlacesMapsError(
                GoogleMapsService.hasKey()
                  ? "PERMISSION_DENIED"
                  : "Missing GOOGLE_PLACES_API_KEY",
              )}
            </p>
            <p className="mt-3 text-sm text-amber-800">
              AI chat does not use Google Maps and is unaffected by this.
            </p>
            <Link href="/app/home" className="mt-4 inline-flex text-sm font-semibold text-amber-950 underline">
              Back to chat
            </Link>
          </section>
        </main>
      </>
    );
  }

  const nearbyAttractions = await GoogleMapsService.searchNearby(
    `attractions near ${details.name}${details.address ? `, ${details.address}` : ""}`,
    4,
  );
  const nearbyRestaurants = await GoogleMapsService.searchNearby(
    `restaurants near ${details.name}${details.address ? `, ${details.address}` : ""}`,
    4,
  );

  const mapEmbed =
    details.lat != null && details.lng != null
      ? `https://maps.google.com/maps?q=${details.lat},${details.lng}&z=15&output=embed`
      : null;

  return (
    <>
      <SetAppHeader title={details.name} showBack />
      <main className="travel-os-content space-y-5 bg-slate-50 px-4 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)] pt-3 md:px-8">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative aspect-[16/10] w-full bg-slate-200">
            {details.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={details.photoUrl.replace("maxH=360", "maxH=900")}
                alt={`Photo of ${details.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <MapPin className="h-10 w-10 text-slate-400" aria-hidden />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-5 pb-4 pt-16">
              <h1 className="text-2xl font-bold tracking-tight text-white">{details.name}</h1>
              {details.category ? (
                <p className="mt-1 text-sm text-white/80">{details.category}</p>
              ) : null}
              {interestLabel ? (
                <div className="mt-2">
                  <DestinationInterestBadge
                    count={interestTravelers}
                    month={interestMonth}
                    className="text-sm font-medium text-white/90"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 p-5">
            {details.rating != null ? (
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
                {details.rating.toFixed(1)}
                {details.userRatingCount > 0 ? (
                  <span className="font-normal text-slate-500">
                    ({details.userRatingCount.toLocaleString()} reviews)
                  </span>
                ) : null}
                {details.priceLevel ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {details.priceLevel}
                  </span>
                ) : null}
              </p>
            ) : null}

            <PlaceActions
              placeId={details.placeId}
              placeName={details.name}
              mapsUrl={details.mapsUrl}
              lat={details.lat}
              lng={details.lng}
              destinationId={topLevelDestination?.id ?? null}
            />
          </div>
        </section>

        {details.photos.length > 1 ? (
          <PlaceGallery photos={details.photos} placeName={details.name} />
        ) : null}

        {details.summary ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">About</h2>
            <p className="mt-2 text-sm leading-7 text-slate-700">{details.summary}</p>
          </section>
        ) : null}

        {details.reviews.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Reviews</h2>
            <div className="mt-3 space-y-3">
              {details.reviews.map((review, index) => (
                <div key={`${review.author}-${index}`} className="rounded-2xl bg-slate-50 p-3.5">
                  <p className="text-xs font-semibold text-slate-800">
                    {review.author}
                    {review.rating != null ? ` · ★ ${review.rating.toFixed(1)}` : ""}
                    {review.relativeTime ? (
                      <span className="font-normal text-slate-500"> · {review.relativeTime}</span>
                    ) : null}
                  </p>
                  {review.text ? (
                    <p className="mt-1.5 text-sm leading-6 text-slate-700">{review.text}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {details.openingHours.length ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Opening hours</h2>
            <p className="mt-1 text-xs text-slate-500">
              {details.openNow == null
                ? "Open status unavailable"
                : details.openNow
                  ? "Open now"
                  : "Closed now"}
            </p>
            <div className="mt-2 space-y-1.5">
              {details.openingHours.map((row) => (
                <p key={row} className="text-sm text-slate-700">
                  {row}
                </p>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Contact</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            {details.address ? (
              <p>
                <span className="font-medium text-slate-500">Address · </span>
                {details.address}
              </p>
            ) : null}
            {details.phone ? (
              <p>
                <span className="font-medium text-slate-500">Phone · </span>
                <a href={`tel:${details.phone}`} className="font-semibold text-emerald-700">
                  {details.phone}
                </a>
              </p>
            ) : null}
            {details.websiteUrl ? (
              <p>
                <span className="font-medium text-slate-500">Website · </span>
                <a
                  href={details.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600"
                >
                  Visit site
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </p>
            ) : null}
            {details.mapsUrl ? (
              <p>
                <a
                  href={details.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600"
                >
                  Open in Google Maps
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Popular times</h2>
          <p className="mt-2 text-sm text-slate-500">
            Popular times are not available through the Places API for this location.
          </p>
        </section>

        {mapEmbed ? (
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <h2 className="px-5 pt-5 text-base font-semibold text-slate-900">Map</h2>
            <iframe
              title={`Map of ${details.name}`}
              src={mapEmbed}
              className="mt-3 aspect-[16/10] w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </section>
        ) : null}

        {nearbyAttractions.filter((p) => p.placeId !== details.placeId).length ? (
          <NearbySection
            title="Nearby attractions"
            cards={nearbyAttractions.filter((p) => p.placeId !== details.placeId)}
          />
        ) : null}

        {nearbyRestaurants.filter((p) => p.placeId !== details.placeId).length ? (
          <NearbySection
            title="Nearby restaurants"
            cards={nearbyRestaurants.filter((p) => p.placeId !== details.placeId)}
          />
        ) : null}
      </main>
    </>
  );
}

function NearbySection({
  title,
  cards,
}: {
  title: string;
  cards: Array<{
    placeId: string;
    name: string;
    address: string;
    rating: number | null;
    userRatingCount: number;
    photoUrl: string;
    photoName: string | null;
  }>;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {cards.map((card) => {
          const href = `/app/place/${encodeURIComponent(card.placeId)}`;
          const photo = card.photoUrl || (card.photoName ? buildPhotoUrl(card.photoName) : "");
          return (
            <Link
              key={card.placeId}
              href={href}
              className="w-44 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
            >
              <div className="h-24 bg-slate-200">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 text-sm font-semibold text-slate-900">{card.name}</p>
                {card.rating != null ? (
                  <p className="mt-1 text-xs text-slate-600">★ {card.rating.toFixed(1)}</p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
