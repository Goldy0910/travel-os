import BackLink from "@/app/app/_components/back-link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { countTripMembers, getMemberRole, isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import TripActivityFeed from "./_components/trip-activity-feed";
import {
  groupCommentsByEntityId,
  memberDisplayLabel,
  type MemberLabelRow,
} from "@/lib/trip-entity-comments";
import type { EntityCommentDTO } from "./_components/entity-comments-block";
import JoinWelcomeBanner from "./_components/join-welcome-banner";
import TripItineraryShell, {
  type ItineraryItemDTO,
} from "./_components/trip-itinerary-shell";

type TripPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type TripRecord = Record<string, string | number | null>;
type ItineraryDay = { id: string | number; date: string | null };
type ItineraryItem = {
  id: string | number;
  itinerary_day_id: string | number | null;
  date: string | null;
  activity_name: string | null;
  title: string | null;
  location: string | null;
  time: string | null;
  created_at?: string | null;
};

function pickFirstString(record: TripRecord, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return fallback;
}

function formatTripDate(input: string | null) {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function extractYMD(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m?.[1] ?? null;
}

function enumerateDateStrings(startYmd: string, endYmd: string): string[] {
  const parts = (s: string) => s.split("-").map(Number);
  const sa = parts(startYmd);
  const sb = parts(endYmd);
  if (sa.length !== 3 || sb.length !== 3 || sa.some((n) => Number.isNaN(n)) || sb.some((n) => Number.isNaN(n))) {
    return [];
  }
  const start = new Date(sa[0], sa[1] - 1, sa[2]);
  const end = new Date(sb[0], sb[1] - 1, sb[2]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function toItemDTO(item: ItineraryItem): ItineraryItemDTO {
  return {
    id: String(item.id),
    activity_name: item.activity_name,
    title: item.title,
    location: item.location,
    time: item.time,
    date: item.date,
  };
}

export default async function TripPage({ params, searchParams }: TripPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const errorParam = query.error;
  const error =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";
  const showJoinWelcome =
    query.welcome === "1" || query.welcome === "true";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const member = await isTripMember(supabase, tripId, user.id);
  if (!member) {
    redirect("/app/home");
  }

  const { data: tripData } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!tripData) {
    redirect("/app/home");
  }

  const memberCount = await countTripMembers(supabase, tripId);
  const myRole = await getMemberRole(supabase, tripId, user.id);
  const canDeleteTrip = myRole === "organizer";

  const { data: daysData } = await supabase
    .from("itinerary_days")
    .select("id, date")
    .eq("trip_id", tripId)
    .order("date", { ascending: true });

  const days = (daysData ?? []) as ItineraryDay[];
  const { data: itemsData } = await supabase
    .from("itinerary_items")
    .select("id, itinerary_day_id, date, activity_name, title, location, time, created_at")
    .eq("trip_id", tripId)
    .order("time", { ascending: true });

  const items = (itemsData ?? []) as ItineraryItem[];
  const [{ data: activityCommentsData }, { data: membersForLabels }] = await Promise.all([
    supabase
      .from("comments")
      .select("id, trip_id, user_id, entity_type, entity_id, content, created_at")
      .eq("trip_id", tripId)
      .eq("entity_type", "activity"),
    supabase.from("members").select("user_id, name, email").eq("trip_id", tripId),
  ]);

  const activityCommentsByItemId = groupCommentsByEntityId(
    (activityCommentsData ?? []) as EntityCommentDTO[],
  );

  const memberLabelByUserId: Record<string, string> = {};
  for (const row of membersForLabels ?? []) {
    const m = row as MemberLabelRow;
    if (m.user_id) {
      memberLabelByUserId[m.user_id] = memberDisplayLabel(m);
    }
  }
  const metaName = user.user_metadata?.full_name;
  if (!memberLabelByUserId[user.id]) {
    memberLabelByUserId[user.id] =
      (typeof metaName === "string" && metaName.trim()) ||
      user.email?.split("@")[0] ||
      "You";
  }

  const dayById = new Map<string, ItineraryDay>();
  days.forEach((day) => dayById.set(String(day.id), day));

  const activityKeysFromItems = new Set<string>();
  days.forEach((day) => {
    if (day.date) activityKeysFromItems.add(day.date);
  });
  items.forEach((item) => {
    const key =
      item.date ??
      (item.itinerary_day_id != null
        ? dayById.get(String(item.itinerary_day_id))?.date ?? null
        : null);
    if (key) activityKeysFromItems.add(key);
  });

  const trip = tripData as TripRecord;
  const startRaw = pickFirstString(trip, ["start_date", "startDate", "date_from"], "");
  const endRaw = pickFirstString(trip, ["end_date", "endDate", "date_to"], "");
  const ymdStart = extractYMD(startRaw);
  const ymdEnd = extractYMD(endRaw);
  const rangeDates =
    ymdStart && ymdEnd ? enumerateDateStrings(ymdStart, ymdEnd) : [];

  const orderedDates =
    rangeDates.length > 0
      ? [...new Set([...rangeDates, ...activityKeysFromItems])].sort((a, b) =>
          a < b ? -1 : a > b ? 1 : 0,
        )
      : [...activityKeysFromItems].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const groupedMap = new Map<string, ItineraryItem[]>();
  orderedDates.forEach((d) => groupedMap.set(d, []));

  items.forEach((item) => {
    const key =
      item.date ??
      (item.itinerary_day_id != null
        ? dayById.get(String(item.itinerary_day_id))?.date ?? null
        : null);
    if (!key) return;
    if (!groupedMap.has(key)) groupedMap.set(key, []);
    groupedMap.get(key)?.push(item);
  });

  const grouped: Record<string, ItineraryItemDTO[]> = {};
  orderedDates.forEach((date) => {
    grouped[date] = (groupedMap.get(date) ?? []).map(toItemDTO);
  });

  const title = pickFirstString(trip, ["title", "name", "trip_name"], "Trip");
  const location = pickFirstString(trip, ["location", "destination", "city"], "");
  const tripEditDefaults = {
    title,
    location: location || title,
    startDate: ymdStart ?? "",
    endDate: ymdEnd ?? "",
  };
  const startDate = formatTripDate(
    pickFirstString(trip, ["start_date", "startDate", "date_from"], ""),
  );
  const endDate = formatTripDate(
    pickFirstString(trip, ["end_date", "endDate", "date_to"], ""),
  );
  const dateRangeLabel =
    startDate && endDate ? `${startDate} - ${endDate}` : "Dates not set";

  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const defaultDateForAdd = orderedDates[0] ?? todayYmd;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink href="/app/trips">All trips</BackLink>
          <BackLink href="/app/home">Home</BackLink>
        </div>

        {showJoinWelcome ? (
          <JoinWelcomeBanner tripId={tripId} tripTitle={title} />
        ) : null}

        <TripItineraryShell
          tripId={tripId}
          tripTitle={title}
          dateRangeLabel={dateRangeLabel}
          memberCount={memberCount}
          canDeleteTrip={canDeleteTrip}
          tripEditDefaults={tripEditDefaults}
          orderedDates={orderedDates}
          grouped={grouped}
          initialError={error}
          defaultDateForAdd={defaultDateForAdd}
          activityCommentsByItemId={activityCommentsByItemId}
          currentUserId={user.id}
          memberLabelByUserId={memberLabelByUserId}
        />

        <TripActivityFeed tripId={tripId} />
      </div>
    </main>
  );
}
