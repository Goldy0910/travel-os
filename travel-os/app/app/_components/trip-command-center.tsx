import {
  ACTIVITY_LOG_FEED_LIMIT,
  HOME_TODAY_ITINERARY_LIMIT,
  activityListScrollAreaClass,
} from "@/app/app/_lib/activity-scroll-styles";
import { fetchTripActivityLogs, formatActivityLogTime } from "@/lib/activity-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { countTripMembers, fetchTripsViaMembership } from "@/lib/trip-membership";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  pickFirstString,
  type TripRecord,
} from "@/app/app/_lib/trip-formatters";
import { formatInr } from "@/app/app/trip/[id]/expenses/_lib/format-inr";
import { detectDocumentKind } from "@/app/app/trip/[id]/docs/_lib/file-kind";
import {
  addDaysYmd,
  dashboardTimezone,
  getYmdInTz,
  pickActiveTripId,
  tripDayContext,
} from "@/app/app/_lib/trip-command-helpers";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { SetAppHeader } from "@/components/AppHeader";
import HomeTripSwitcher from "./home-trip-switcher";
import TripCommandFab from "./trip-command-fab";

type ExpenseRecord = Record<string, string | number | null>;
type GenericRecord = Record<string, string | number | null>;
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

function pickFirstNumber(record: ExpenseRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function computeMyShare(expense: ExpenseRecord): number {
  const amount = pickFirstNumber(expense, ["amount", "total_amount"]);
  const explicitShare = pickFirstNumber(expense, ["your_share", "share_amount"]);
  if (explicitShare > 0) return explicitShare;
  const splitType = pickFirstString(expense, ["split_type"], "equal").toLowerCase();
  if (splitType === "full") return amount;
  if (splitType === "none") return 0;
  return amount / 2;
}

function netForTrip(
  expenses: ExpenseRecord[],
  currentUserLabel: string,
  userId: string,
): number {
  return expenses.reduce((sum, expense) => {
    const amount = pickFirstNumber(expense, ["amount", "total_amount"]);
    const explicitShare = pickFirstNumber(expense, ["your_share", "share_amount"]);
    const splitType = pickFirstString(expense, ["split_type"], "equal").toLowerCase();
    const paidBy = pickFirstString(expense, ["paid_by", "payer"], "unknown");
    const isPaidByYou =
      paidBy === currentUserLabel || paidBy === userId || paidBy.toLowerCase() === "you";
    const share =
      explicitShare > 0
        ? explicitShare
        : splitType === "full"
          ? amount
          : splitType === "none"
            ? 0
            : amount / 2;
    if (isPaidByYou) return sum + (amount - share);
    return sum - share;
  }, 0);
}

function formatLongDate(ymd: string, tz: string) {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return ymd;
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(noonUtc));
}

function sortItemsByTime(items: ItineraryItem[]) {
  return [...items].sort((a, b) => {
    const ta = (a.time ?? "").trim();
    const tb = (b.time ?? "").trim();
    if (ta && tb) return ta.localeCompare(tb);
    if (ta) return -1;
    if (tb) return 1;
    return 0;
  });
}

function buildReminders(sortedToday: ItineraryItem[]): string[] {
  const out: string[] = [];
  const first = sortedToday[0];
  if (first) {
    const n = first.activity_name || first.title || "Activity";
    if (first.time) {
      out.push(`Next up: ${n} at ${first.time}`);
    }
  }
  for (const item of sortedToday) {
    const name = (item.activity_name || item.title || "").trim();
    const lower = name.toLowerCase();
    const t = item.time ? ` at ${item.time}` : "";
    if (lower.includes("flight") && !out.some((s) => s.includes("Flight"))) {
      out.push(`✈️ Flight coming up${t}: ${name}`);
    }
    if (
      (lower.includes("hotel") || lower.includes("check-in")) &&
      !out.some((s) => s.includes("Hotel"))
    ) {
      out.push(`🏨 Hotel / check-in${t}: ${name}`);
    }
  }
  return out.slice(0, 4);
}

function initialsFromName(name: string, email: string) {
  const base = name.trim() || email.trim() || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export default async function TripCommandCenter({ searchParams }: TripCommandCenterProps) {
  const query = (await searchParams) ?? {};
  const tripParam = query.trip;
  const preferredTripId =
    typeof tripParam === "string" && tripParam.length > 0 ? tripParam : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/app/login");

  const { trips: tripsRaw, tripIds } = await fetchTripsViaMembership(supabase, user.id);
  const trips = tripsRaw as TripRecord[];

  const activeTripId = pickActiveTripId(trips, tripIds, preferredTripId);
  const tz = dashboardTimezone();
  const todayYmd = getYmdInTz(new Date(), tz);
  const todayLabel = formatLongDate(todayYmd, tz);

  const tripOptions = trips
    .map((trip, index) => {
      const id =
        typeof trip.id === "string" || typeof trip.id === "number" ? String(trip.id) : null;
      if (!id) return null;
      return {
        id,
        title: pickFirstString(trip, ["title", "name", "trip_name"], `Trip ${index + 1}`),
      };
    })
    .filter((t): t is { id: string; title: string } => t != null);

  if (!activeTripId) {
    return (
      <>
        <SetAppHeader title="Travel Till 99" showBack={false} />
        <main className="min-h-screen bg-slate-50 px-4 py-6 pb-32">
          <div className="mx-auto w-full max-w-md space-y-6">
            <header className="relative text-center">
              <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
                Travel OS
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">Trip command center</h1>
              <p className="mt-2 text-sm text-slate-600">
                Your live home for everything happening on the road.
              </p>
            </header>
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="text-4xl" aria-hidden>
              ✈️
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-900">No trips yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Create a trip to see today&apos;s plan, docs, and expenses here.
            </p>
            <Link
              href="/app/create-trip"
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 text-sm font-semibold text-white shadow-md"
            >
              Create trip
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
            </Link>
            <Link
              href="/app/trips"
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 underline"
            >
              Browse all trips
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-500" />
            </Link>
            <Link
              href="/"
              className="mt-2 inline-flex items-center gap-2 text-sm text-slate-500 underline"
            >
              Website
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </main>
      </>
    );
  }

  const activeTrip = trips.find(
    (t) => (typeof t.id === "string" || typeof t.id === "number") && String(t.id) === activeTripId,
  ) as TripRecord | undefined;

  const tripTitle = activeTrip
    ? pickFirstString(activeTrip, ["title", "name", "trip_name"], "Trip")
    : "Trip";
  const startLabel = activeTrip
    ? pickFirstString(activeTrip, ["start_date", "startDate", "date_from"], "")
    : "";
  const endLabel = activeTrip
    ? pickFirstString(activeTrip, ["end_date", "endDate", "date_to"], "")
    : "";
  const dateRange =
    startLabel && endLabel
      ? `${new Date(startLabel).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – ${new Date(endLabel).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}`
      : "Dates not set";

  const dayCtx = activeTrip ? tripDayContext(activeTrip, todayYmd) : null;
  const memberCount = await countTripMembers(supabase, activeTripId);

  const [
    { data: todayItemsData },
    { data: tomorrowItemsData },
    { data: docsData },
    { data: expData },
    { data: membersData },
    profileRes,
  ] =
    await Promise.all([
      supabase
        .from("itinerary_items")
        .select("id, date, activity_name, title, location, time")
        .eq("trip_id", activeTripId)
        .eq("date", todayYmd)
        .order("time", { ascending: true })
        .limit(HOME_TODAY_ITINERARY_LIMIT),
      supabase
        .from("itinerary_items")
        .select("id, date, activity_name, title, location, time")
        .eq("trip_id", activeTripId)
        .eq("date", addDaysYmd(todayYmd, 1))
        .order("time", { ascending: true })
        .limit(4),
      supabase
        .from("documents")
        .select("id, file_name, file_url, created_at")
        .eq("trip_id", activeTripId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("expenses").select("*").eq("trip_id", activeTripId),
      supabase
        .from("members")
        .select("id, user_id, name, email, role, created_at")
        .eq("trip_id", activeTripId)
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    ]);

  const todayItems = sortItemsByTime((todayItemsData ?? []) as ItineraryItem[]);
  const tomorrowItems = sortItemsByTime((tomorrowItemsData ?? []) as ItineraryItem[]).slice(0, 2);
  const docs = (docsData ?? []) as GenericRecord[];
  const expenses = (expData ?? []) as ExpenseRecord[];
  const members = (membersData ?? []) as GenericRecord[];
  const profileRow = profileRes.error ? null : profileRes.data;
  const profileNameFromDb =
    profileRow &&
    typeof profileRow.name === "string" &&
    profileRow.name.trim().length > 0
      ? profileRow.name.trim()
      : "";
  const metaName =
    typeof user.user_metadata?.full_name === "string" &&
    user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : "";
  const currentUserDisplayName =
    profileNameFromDb || metaName || user.email?.split("@")[0] || "You";

  const currentUserLabel = user.email ?? user.id;
  const totalSpent = expenses.reduce(
    (s, e) => s + pickFirstNumber(e, ["amount", "total_amount"]),
    0,
  );
  const yourShareTotal = expenses.reduce((s, e) => s + computeMyShare(e), 0);
  const net = netForTrip(expenses, currentUserLabel, user.id);

  const reminders = buildReminders(todayItems);

  const { data: activityRows } = await fetchTripActivityLogs(
    supabase,
    activeTripId,
    ACTIVITY_LOG_FEED_LIMIT,
  );
  const topFeed = (activityRows ?? []).map((row) => ({
    id: String(row.id ?? ""),
    text: typeof row.action === "string" ? row.action : "",
    when: formatActivityLogTime(
      typeof row.created_at === "string" ? row.created_at : undefined,
    ),
  }));

  return (
    <>
      <SetAppHeader title="Travel Till 99" showBack={false} />
      <main className="min-h-screen bg-slate-100 pb-36 pt-0">
        <div className="mx-auto w-full max-w-md">
          <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-slate-50/95 px-4 py-4 shadow-sm shadow-slate-900/5 backdrop-blur-md">
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-inner">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Active trip
                </p>
                <h1 className="mt-1 truncate text-xl font-bold leading-tight">{tripTitle}</h1>
                <p className="mt-1 text-sm text-slate-300">{dateRange}</p>
                {dayCtx ? (
                  <p className="mt-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    {dayCtx.label}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-400">
                  {memberCount} member{memberCount === 1 ? "" : "s"}
                </p>
              </div>
              <HomeTripSwitcher trips={tripOptions} currentId={activeTripId} />
            </div>
          </header>

        <div className="space-y-5 px-4 py-5">
          <section className="overflow-hidden rounded-3xl bg-white shadow-md shadow-slate-900/8 ring-1 ring-slate-200/80">
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">Today</h2>
              <p className="mt-1 text-sm text-slate-600">{todayLabel}</p>
            </div>
            <div className="p-5">
              {todayItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No plans yet for today</p>
                  <Link
                    href={`/app/trip/${activeTripId}?tab=itinerary`}
                    className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white"
                  >
                    + Add activity
                    <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
                  </Link>
                </div>
              ) : (
                <div
                  className={activityListScrollAreaClass}
                  role="region"
                  aria-label="Today’s activities"
                >
                  <ul className="space-y-3">
                    {todayItems.map((item) => (
                      <li
                        key={String(item.id)}
                        className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                          {item.time || "Time TBD"}
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {item.activity_name || item.title || "Activity"}
                        </p>
                        {item.location ? (
                          <p className="mt-1 text-sm text-slate-600">{item.location}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {todayItems.length > 0 ? (
                <Link
                  href={`/app/trip/${activeTripId}?tab=itinerary`}
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm"
                >
                  + Add activity
                  <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-700" />
                </Link>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
              Quick access
            </h2>
            {docs.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600 shadow-sm">
                No documents yet.{" "}
                <Link
                  href={`/app/trip/${activeTripId}?tab=docs`}
                  className="inline-flex items-center gap-1 font-semibold text-slate-900 underline"
                >
                  Upload
                  <LinkLoadingIndicator spinnerClassName="h-3 w-3 text-slate-700" />
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {docs.map((doc) => {
                  const id = doc.id != null ? String(doc.id) : "";
                  const name = pickFirstString(doc, ["file_name"], "File");
                  const url = pickFirstString(doc, ["file_url"], "");
                  const kind = detectDocumentKind(
                    typeof doc.file_name === "string" ? doc.file_name : null,
                    typeof doc.file_url === "string" ? doc.file_url : null,
                  );
                  return (
                    <li key={id || name}>
                      <a
                        href={url || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition active:bg-slate-50"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">
                          {kind === "pdf" ? "📄" : kind === "image" ? "🖼️" : "📎"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                          {name}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-900/8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Expenses</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span aria-hidden>💰</span>
                  Total spent
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatInr(totalSpent)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span aria-hidden>👤</span>
                  Your share
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatInr(yourShareTotal)}</p>
              </div>
            </div>
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-center text-sm font-bold ${
                net < 0
                  ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                  : net > 0
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
                    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {net < 0 && <>You owe {formatInr(Math.abs(net))}</>}
              {net > 0 && <>You are owed {formatInr(net)}</>}
              {net === 0 && <>You&apos;re settled up on this trip</>}
            </div>
            <Link
              href={`/app/trip/${activeTripId}?tab=expenses`}
              className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white"
            >
              + Add expense
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-white" />
            </Link>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-900/8">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Group</h2>
              <Link
                href={`/app/trip/${activeTripId}?tab=members`}
                className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-indigo-600"
              >
                Manage
                <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-indigo-600" />
              </Link>
            </div>
            <ul className="mt-4 flex flex-wrap gap-3">
              {members.length === 0 ? (
                <li className="text-sm text-slate-600">No member rows yet.</li>
              ) : (
                members.map((m) => {
                  const memberUserId =
                    typeof m.user_id === "string" || typeof m.user_id === "number"
                      ? String(m.user_id)
                      : "";
                  const name =
                    memberUserId === user.id
                      ? currentUserDisplayName
                      : pickFirstString(m, ["name"], "");
                  const email = pickFirstString(m, ["email"], "");
                  const label = name || email || "Member";
                  const ini = initialsFromName(name, email);
                  return (
                    <li
                      key={String(m.id ?? email)}
                      className="flex min-h-11 min-w-0 items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-1.5 pr-4 ring-1 ring-slate-200/80"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {ini}
                      </span>
                      <span className="max-w-[140px] truncate text-sm font-medium text-slate-900">
                        {label}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Recent activity
              </p>
              {topFeed.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No recent updates.</p>
              ) : (
                <div
                  className={`mt-2 ${activityListScrollAreaClass}`}
                  role="region"
                  aria-label="Recent trip activity"
                >
                  <ul className="space-y-2">
                    {topFeed.map((f) => (
                      <li key={f.id || f.text} className="text-sm text-slate-700">
                        <span className="text-slate-400">·</span> {f.text}
                        {f.when ? (
                          <span className="mt-0.5 block text-xs text-slate-400">{f.when}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-900/8">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Coming up</h2>
            {tomorrowItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Nothing scheduled for tomorrow yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {tomorrowItems.map((item) => (
                  <li
                    key={String(item.id)}
                    className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <p className="text-xs font-semibold text-violet-600">{item.time || "—"}</p>
                    <p className="mt-1 font-medium text-slate-900">
                      {item.activity_name || item.title || "Activity"}
                    </p>
                    {item.location ? (
                      <p className="mt-1 text-xs text-slate-600">{item.location}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/app/trip/${activeTripId}?tab=itinerary`}
              className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-600"
            >
              Full itinerary →
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-indigo-600" />
            </Link>
          </section>

          {reminders.length > 0 ? (
            <section className="rounded-3xl border border-amber-200/80 bg-amber-50/60 p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900/80">
                Reminders
              </h2>
              <ul className="mt-3 space-y-2">
                {reminders.map((r, i) => (
                  <li key={i} className="text-sm font-medium text-amber-950/90">
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <footer className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 pb-4 text-center">
            <Link
              href="/app/trips"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline"
            >
              All trips
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-500" />
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline"
            >
              Website
              <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-500" />
            </Link>
          </footer>
        </div>
        <TripCommandFab tripId={activeTripId} />
      </div>
      </main>
    </>
  );
}
