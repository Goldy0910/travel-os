import { selectPrimaryTrip } from "@/app/app/_lib/use-primary-trip";
import { pickFirstString, type TripRecord } from "@/app/app/_lib/trip-formatters";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getOrCacheTravelPlacePhotoUrls } from "@/lib/travel-place-photo-cache";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { SetAppHeader } from "@/components/AppHeader";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe2 } from "lucide-react";

type ItineraryItem = {
  id: string | number;
  date: string | null;
  activity_name: string | null;
  title: string | null;
  location: string | null;
  time: string | null;
};

type TripCommandCenterProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type StatusType = "done" | "upcoming" | "in-progress";

function parseYmd(raw: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  return m?.[1] ?? null;
}

function parseMinutes(raw: string | null): number | null {
  if (!raw) return null;
  const m = /(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)?/i.exec(raw.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  const meridian = m[3]?.toUpperCase();
  if (meridian === "AM" && h === 12) h = 0;
  if (meridian === "PM" && h < 12) h += 12;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function classifyStatus(timeRaw: string | null, nowMinutes: number): StatusType {
  const minutes = parseMinutes(timeRaw);
  if (minutes == null) return "upcoming";
  if (Math.abs(minutes - nowMinutes) <= 30) return "in-progress";
  if (minutes < nowMinutes) return "done";
  return "upcoming";
}

function nowMinutesInTimeZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function getTodayYmd(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

function formatRange(startRaw: string, endRaw: string): string {
  const start = parseYmd(startRaw);
  const end = parseYmd(endRaw);
  if (!start || !end) return "Dates not set";
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return "Dates not set";
  const short = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });
  const shortWithYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${short.format(startDate)} - ${shortWithYear.format(endDate)}`;
}

function getStatusTone(status: StatusType) {
  if (status === "done") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "in-progress") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
}

function getTripCoverStyle(trip: TripRecord): { image: string; color: string } {
  const image = pickFirstString(trip, ["cover_image", "coverImage", "image_url"], "");
  const color = pickFirstString(trip, ["cover_color", "coverColor", "color"], "");
  return { image, color };
}

function statusLabel(status: StatusType) {
  if (status === "in-progress") return "In progress";
  if (status === "done") return "Done";
  return "Upcoming";
}

export default async function TripCommandCenter({ searchParams }: TripCommandCenterProps) {
  await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const { trips: tripsRaw } = await fetchTripsViaMembership(supabase, user.id);
  const trips = tripsRaw as TripRecord[];
  const now = new Date();
  const { trip: primaryTrip, tripId: primaryTripId } = selectPrimaryTrip(trips, now);

  if (!primaryTrip || !primaryTripId) {
    return (
      <>
        <SetAppHeader title="Travel Till 99" showBack={false} />
        <main className="min-h-screen bg-slate-50 px-4 py-6 pb-32">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="text-4xl" aria-hidden>
              ✈️
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-900">No trips yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Create a trip to unlock your personalized home experience.
            </p>
            <Link
              href="/app/create-trip"
              prefetch
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white"
            >
              Create trip
            </Link>
          </div>
        </main>
      </>
    );
  }

  const tripTitle = pickFirstString(primaryTrip, ["title", "name", "trip_name"], "Trip");
  const destination = pickFirstString(primaryTrip, ["destination", "location", "city"], "Destination");
  const startRaw = pickFirstString(primaryTrip, ["start_date", "startDate", "date_from"], "");
  const endRaw = pickFirstString(primaryTrip, ["end_date", "endDate", "date_to"], "");
  const dateRange = formatRange(startRaw, endRaw);
  const cover = getTripCoverStyle(primaryTrip);
  const photoByLocation = await getOrCacheTravelPlacePhotoUrls(supabase, [destination]);
  const destinationPhotoUrl = photoByLocation.get(destination) ?? "";

  const timeZone = "Asia/Kolkata";
  const todayYmd = getTodayYmd(timeZone, now);
  const nowMinutes = nowMinutesInTimeZone(now, timeZone);

  const { data: todayDayRows } = await supabase
    .from("itinerary_days")
    .select("id")
    .eq("trip_id", primaryTripId)
    .eq("date", todayYmd);
  const todayDayIds = (todayDayRows ?? [])
    .map((row) => (row.id != null ? String(row.id) : ""))
    .filter((v) => v.length > 0);

  const { data: todayItemsByDate } = await supabase
    .from("itinerary_items")
    .select("id, date, activity_name, title, location, time")
    .eq("trip_id", primaryTripId)
    .eq("date", todayYmd)
    .order("time", { ascending: true });
  const { data: todayItemsByDay } =
    todayDayIds.length > 0
      ? await supabase
          .from("itinerary_items")
          .select("id, date, activity_name, title, location, time")
          .eq("trip_id", primaryTripId)
          .in("itinerary_day_id", todayDayIds)
          .order("time", { ascending: true })
      : { data: [] as ItineraryItem[] };

  const mergedTodayItems = [...(todayItemsByDate ?? []), ...(todayItemsByDay ?? [])] as ItineraryItem[];
  const seenIds = new Set<string>();
  const todayItems = mergedTodayItems.filter((item) => {
    const id = String(item.id);
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  const addExpenseHref = `/app/trip/${primaryTripId}?tab=expenses&quickAction=expense`;
  const addActivityHref = `/app/trip/${primaryTripId}?tab=itinerary&quickAction=activity`;
  const uploadDocHref = `/app/trip/${primaryTripId}?tab=connect&section=docs&quickAction=doc`;
  const inviteHref = `/app/trip/${primaryTripId}?tab=connect&section=members`;
  const languageHref = `/app/trip/${primaryTripId}?tab=language`;
  const emergencyHref = `/app/trip/${primaryTripId}/emergency`;
  const restaurantsHref = `/app/trip/${primaryTripId}?tab=food&foodTab=discover`;
  const menuHref = `/app/trip/${primaryTripId}?tab=food&foodTab=menu`;

  return (
    <>
      <SetAppHeader title="Travel Till 99" showBack={false} />
      <main className="min-h-screen bg-slate-50 pb-32 pt-4">
        <div className="mx-auto w-full max-w-md space-y-5 px-4">
          <section data-testid="section-today" className="space-y-4">
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div
                className="h-28 w-full bg-gradient-to-br from-indigo-200 via-sky-100 to-violet-100"
                style={{
                  backgroundImage: cover.image
                    ? `url(${cover.image})`
                    : destinationPhotoUrl
                      ? `url(${destinationPhotoUrl})`
                      : undefined,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundColor: cover.color || undefined,
                }}
              />
              <div className="space-y-2 px-4 pb-4 pt-3">
                <div className="flex items-center gap-2.5">
                  {destinationPhotoUrl ? (
                    <div
                      className="h-10 w-10 shrink-0 rounded-lg bg-cover bg-center ring-1 ring-slate-200"
                      style={{ backgroundImage: `url(${destinationPhotoUrl})` }}
                      aria-hidden
                    />
                  ) : null}
                  <h1 className="text-xl font-semibold leading-tight text-slate-900">
                    <Link
                      href={`/app/trip/${primaryTripId}?tab=itinerary`}
                      prefetch
                      className="rounded-md underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      {tripTitle}
                    </Link>
                  </h1>
                </div>
                <p className="text-sm text-slate-600">{destination}</p>
                <p className="text-sm text-slate-500">{dateRange}</p>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Today&apos;s activities</h2>
                <Link
                  href={addActivityHref}
                  prefetch
                  className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 active:scale-[0.98]"
                >
                  Add
                </Link>
              </div>
              <div
                className="h-[220px] overflow-y-auto pr-1 [scroll-behavior:smooth] [-webkit-overflow-scrolling:touch] md:h-[260px]"
                role="region"
                aria-label="Today activities list"
              >
                {todayItems.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                    Nothing planned for today
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {todayItems.map((item) => {
                      const status = classifyStatus(item.time, nowMinutes);
                      return (
                        <li
                          key={String(item.id)}
                          className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">
                                {item.activity_name || item.title || "Activity"}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">{item.time || "Time TBD"}</p>
                            </div>
                            <span
                              className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${getStatusTone(status)}`}
                            >
                              {statusLabel(status)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </article>
          </section>

          <section data-testid="section-actions" className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: addExpenseHref, icon: "💸", label: "Add Expense" },
                { href: addActivityHref, icon: "🗓️", label: "Add Activity" },
                { href: uploadDocHref, icon: "📄", label: "Upload Doc" },
                { href: inviteHref, icon: "👥", label: "Invite Member" },
              ].map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  prefetch
                  className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm transition active:scale-[0.98]"
                >
                  <span aria-hidden>{action.icon}</span>
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
          </section>

          <section data-testid="section-tools" className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Tools</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { href: languageHref, icon: "🗣️", label: "Language Translator" },
                { href: emergencyHref, icon: "🆘", label: "Emergency" },
                { href: restaurantsHref, icon: "🍽️", label: "Restaurants" },
                { href: menuHref, icon: "📋", label: "Menu Translator" },
                { href: "/app/tools/visa3", icon: "", label: "Visa", Icon: Globe2 },
                { href: "/app/esim", icon: "📶", label: "eSIM" },
                { href: "/app/local-apps", icon: "📱", label: "Local Apps" },
                { href: "/app/forex", icon: "💱", label: "Forex" },
              ].map((tool) => (
                <Link
                  key={tool.label}
                  href={tool.href}
                  prefetch
                  className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.98]"
                >
                  {tool.Icon ? (
                    <tool.Icon className="h-5 w-5 text-slate-700" aria-hidden />
                  ) : (
                    <span className="text-xl" aria-hidden>
                      {tool.icon}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-slate-800">{tool.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <Link
          href="/app/create-trip"
          prefetch
          aria-label="Create new trip"
          className="fixed bottom-[var(--travel-os-fab-bottom)] right-[max(1rem,env(safe-area-inset-right,0px))] z-[122] flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/25"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.6}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </main>
    </>
  );
}
