import { SetAppHeader } from "@/components/AppHeader";
import { getTravelGuidesForPlace } from "@/lib/travelGuides";
import { pruneItineraryOutsideTripRange } from "@/lib/itinerary-trip-range";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { countTripMembers, getMemberRole, isTripMember } from "@/lib/trip-membership";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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
import TripMembersPanel from "./_components/trip-members-panel";
import TripGuidesPanel from "./_components/trip-guides-panel";
import TripSwipeTabs from "./_components/trip-swipe-tabs";
import TripTabsFallback from "./_components/trip-tabs-fallback";
import TripChatClient from "./chat/_components/trip-chat-client";
import TripExpensesClient from "./expenses/_components/trip-expenses-client";
import { loadTripTabPanelsData } from "./_lib/load-trip-panels-data";
import { parseConnectSectionFromSearch, parseTripTabParam } from "./_lib/trip-tab-keys";
import ChecklistTab from "@/app/app/_components/ChecklistTab";
import LanguageClient from "@/app/app/trip/[id]/language/_components/LanguageClient";
import FoodTab from "@/components/FoodTab";


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

function pickFirstQuery(
  query: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = query[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0] != null && typeof v[0] === "string") return v[0];
  return "";
}

function decodeOptionalQueryParam(raw: string): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function TripPage({ params, searchParams }: TripPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const showJoinWelcome =
    query.welcome === "1" || query.welcome === "true";
  const rawTabQuery = pickFirstQuery(query, "tab");
  const activeTab = parseTripTabParam(rawTabQuery);
  const connectSection = parseConnectSectionFromSearch(
    rawTabQuery || null,
    pickFirstQuery(query, "section") || null,
  );
  const quickAction = pickFirstQuery(query, "quickAction").trim().toLowerCase();

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

  const trip = tripData as TripRecord;
  const startRawEarly = pickFirstString(trip, ["start_date", "startDate", "date_from"], "");
  const endRawEarly = pickFirstString(trip, ["end_date", "endDate", "date_to"], "");
  const ymdStart = extractYMD(startRawEarly);
  const ymdEnd = extractYMD(endRawEarly);

  const title = pickFirstString(trip, ["title", "name", "trip_name"], "Trip");
  const location = pickFirstString(trip, ["location", "destination", "city"], "");
  const tripPlace = pickFirstString(
    trip,
    ["place", "location", "destination", "city"],
    "",
  );
  const guidesBundle = activeTab === "guides" ? getTravelGuidesForPlace(tripPlace) : null;
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
  const itineraryDefaults = {
    memberCount: 0,
    canDeleteTrip: false,
    orderedDates: [] as string[],
    grouped: {} as Record<string, ItineraryItemDTO[]>,
    activityCommentsByItemId: {} as Record<string, EntityCommentDTO[]>,
    memberLabelByUserId: {} as Record<string, string>,
    defaultDateForAdd: todayYmd,
  };

  const itineraryData =
    activeTab === "itinerary"
      ? await (async () => {
          if (ymdStart && ymdEnd) {
            try {
              await pruneItineraryOutsideTripRange(supabase, tripId, ymdStart, ymdEnd);
            } catch {
              /* ignore prune errors; display still restricted to trip range */
            }
          }

          const [memberCount, myRole, { data: daysData }, { data: itemsData }, { data: activityCommentsData }, { data: membersForLabels }] =
            await Promise.all([
              countTripMembers(supabase, tripId),
              getMemberRole(supabase, tripId, user.id),
              supabase
                .from("itinerary_days")
                .select("id, date")
                .eq("trip_id", tripId)
                .order("date", { ascending: true }),
              supabase
                .from("itinerary_items")
                .select("id, itinerary_day_id, date, activity_name, title, location, time, created_at")
                .eq("trip_id", tripId)
                .order("time", { ascending: true }),
              supabase
                .from("comments")
                .select("id, trip_id, user_id, entity_type, entity_id, content, created_at")
                .eq("trip_id", tripId)
                .eq("entity_type", "activity"),
              supabase.from("members").select("user_id, name, email").eq("trip_id", tripId),
            ]);

          const days = (daysData ?? []) as ItineraryDay[];
          const items = (itemsData ?? []) as ItineraryItem[];
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

          const rangeDates =
            ymdStart && ymdEnd ? enumerateDateStrings(ymdStart, ymdEnd) : [];
          const orderedDates =
            rangeDates.length > 0
              ? [...rangeDates]
              : [...activityKeysFromItems].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

          const groupedMap = new Map<string, ItineraryItem[]>();
          orderedDates.forEach((d) => groupedMap.set(d, []));
          items.forEach((item) => {
            const raw =
              item.date ??
              (item.itinerary_day_id != null
                ? dayById.get(String(item.itinerary_day_id))?.date ?? null
                : null);
            if (!raw) return;
            const key = extractYMD(String(raw)) ?? String(raw).trim().slice(0, 10);
            if (ymdStart && ymdEnd && (key < ymdStart || key > ymdEnd)) return;
            if (!groupedMap.has(key)) return;
            groupedMap.get(key)?.push(item);
          });

          const grouped: Record<string, ItineraryItemDTO[]> = {};
          orderedDates.forEach((date) => {
            grouped[date] = (groupedMap.get(date) ?? []).map(toItemDTO);
          });

          const activityCommentsByItemId = groupCommentsByEntityId(
            (activityCommentsData ?? []) as EntityCommentDTO[],
          );
          const memberUserIds = Array.from(
            new Set(
              (membersForLabels ?? [])
                .map((row) => {
                  const uid = (row as MemberLabelRow).user_id;
                  return typeof uid === "string" && uid.trim().length > 0 ? uid : "";
                })
                .filter((v) => v.length > 0),
            ),
          );
          const { data: profileRows } =
            memberUserIds.length > 0
              ? await supabase.from("profiles").select("id, name").in("id", memberUserIds)
              : { data: [] as Array<{ id: string; name: string | null }> };
          const profileNameByUserId: Record<string, string> = {};
          for (const row of profileRows ?? []) {
            const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
            const profileName =
              typeof row.name === "string" && row.name.trim().length > 0 ? row.name.trim() : "";
            if (id && profileName) profileNameByUserId[id] = profileName;
          }
          const memberLabelByUserId: Record<string, string> = {};
          for (const row of membersForLabels ?? []) {
            const m = row as MemberLabelRow;
            if (m.user_id) {
              memberLabelByUserId[m.user_id] =
                profileNameByUserId[m.user_id] || memberDisplayLabel(m);
            }
          }
          const metaName = user.user_metadata?.full_name;
          if (!memberLabelByUserId[user.id]) {
            memberLabelByUserId[user.id] =
              (typeof metaName === "string" && metaName.trim()) ||
              user.email?.split("@")[0] ||
              "You";
          }

          return {
            memberCount,
            canDeleteTrip: myRole === "organizer",
            orderedDates,
            grouped,
            activityCommentsByItemId,
            memberLabelByUserId,
            defaultDateForAdd: orderedDates[0] ?? todayYmd,
          };
        })()
      : itineraryDefaults;

  const tabKeyForErrors = activeTab;
  const rawError = decodeOptionalQueryParam(pickFirstQuery(query, "error"));
  const itineraryError = tabKeyForErrors === "itinerary" ? rawError : "";
  const docsSuccess = decodeOptionalQueryParam(pickFirstQuery(query, "success"));

  const panels = await loadTripTabPanelsData(supabase, tripId, user, trip, title, {
    activeTab,
    expensesError: tabKeyForErrors === "expenses" ? rawError : "",
    docsSuccess,
    docsError:
      tabKeyForErrors === "connect" && connectSection === "docs" ? rawError : "",
    membersError:
      tabKeyForErrors === "connect" && connectSection === "members" ? rawError : "",
  });

  const startForChecklist = pickFirstString(trip, ["start_date", "startDate", "date_from"], "");
  const endForChecklist = pickFirstString(trip, ["end_date", "endDate", "date_to"], "");
  const ymdCheckStart = extractYMD(startForChecklist);
  const ymdCheckEnd = extractYMD(endForChecklist);
  let checklistDurationDays = 7;
  if (ymdCheckStart && ymdCheckEnd) {
    const t0 = new Date(`${ymdCheckStart}T12:00:00`).getTime();
    const t1 = new Date(`${ymdCheckEnd}T12:00:00`).getTime();
    if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
      checklistDurationDays = Math.max(1, Math.round((t1 - t0) / 86400000) + 1);
    }
  }
  const checklistTravelMonth = (() => {
    if (!ymdCheckStart) return "";
    const d = new Date(`${ymdCheckStart}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-US", { month: "long" });
  })();

  const checklistActivities: string[] = [];
  if (activeTab === "checklist") {
    const { data: actRows } = await supabase
      .from("itinerary_items")
      .select("activity_name, title")
      .eq("trip_id", tripId)
      .limit(40);
    for (const row of actRows ?? []) {
      const r = row as { activity_name?: string | null; title?: string | null };
      const label = String(r.activity_name || r.title || "").trim();
      if (label) checklistActivities.push(label);
    }
  }

  return (
    <>
      <SetAppHeader title={title} showBack />
      <main className="flex w-full flex-col bg-[#f4f4f0] pb-28">
        <div className="mx-auto flex w-full max-w-[390px] flex-col">
          <Suspense fallback={<TripTabsFallback />}>
            <TripSwipeTabs
              itinerary={
                activeTab === "itinerary" ? (
                  <div className="space-y-5">
                    {showJoinWelcome ? (
                      <JoinWelcomeBanner tripId={tripId} tripTitle={title} />
                    ) : null}
                    <TripItineraryShell
                      tripId={tripId}
                      tripTitle={title}
                      dateRangeLabel={dateRangeLabel}
                      memberCount={itineraryData.memberCount}
                      canDeleteTrip={itineraryData.canDeleteTrip}
                      tripEditDefaults={tripEditDefaults}
                      orderedDates={itineraryData.orderedDates}
                      grouped={itineraryData.grouped}
                      initialError={itineraryError}
                      defaultDateForAdd={itineraryData.defaultDateForAdd}
                      activityCommentsByItemId={itineraryData.activityCommentsByItemId}
                      currentUserId={user.id}
                      memberLabelByUserId={itineraryData.memberLabelByUserId}
                      autoOpenAddActivity={quickAction === "activity"}
                    />
                    <TripActivityFeed tripId={tripId} />
                  </div>
                ) : null
              }
              expenses={
                activeTab === "expenses" ? (
                  <TripExpensesClient
                    tripId={tripId}
                    {...panels.expenses}
                    autoOpenAddExpense={quickAction === "expense"}
                  />
                ) : null
              }
              connectChat={
                activeTab === "connect" ? (
                  <TripChatClient
                    tripId={tripId}
                    currentUserId={user.id}
                    initialMessages={panels.chat.initialMessages}
                    memberLabelByUserId={panels.chat.memberLabelByUserId}
                  />
                ) : null
              }
              connectDocsProps={
                activeTab === "connect"
                  ? {
                      tripId,
                      ...panels.docs,
                      autoOpenUpload: quickAction === "doc",
                    }
                  : null
              }
              guides={
                activeTab === "guides" ? (
                  <TripGuidesPanel bundle={guidesBundle} destinationLabel={tripPlace || location} />
                ) : null
              }
              connectMembers={
                activeTab === "connect" ? <TripMembersPanel {...panels.members} /> : null
              }
              checklist={
                activeTab === "checklist" ? (
                  <ChecklistTab
                    tripId={tripId}
                    destination={tripPlace || location || title}
                    durationDays={checklistDurationDays}
                    travelMonth={checklistTravelMonth}
                    activities={checklistActivities}
                  />
                ) : null
              }
              food={
                activeTab === "food" ? (
                  <FoodTab tripId={tripId} destination={tripPlace || location || title} />
                ) : null
              }
              language={
                activeTab === "language" ? (
                  <LanguageClient
                    tripId={tripId}
                    tripTitle={title}
                    destination={tripPlace || location || title}
                  />
                ) : null
              }
            />
          </Suspense>
        </div>
      </main>
    </>
  );
}
