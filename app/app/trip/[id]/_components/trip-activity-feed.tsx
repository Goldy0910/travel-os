import {
  ACTIVITY_LOG_FEED_LIMIT,
  activityListScrollAreaClass,
} from "@/app/app/_lib/activity-scroll-styles";
import { fetchTripActivityLogs, formatActivityLogTime } from "@/lib/activity-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";

type Props = {
  tripId: string;
};

export default async function TripActivityFeed({ tripId }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) {
    return null;
  }

  const { data: logs, error } = await fetchTripActivityLogs(
    supabase,
    tripId,
    ACTIVITY_LOG_FEED_LIMIT,
  );

  if (error) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Activity</h2>
        <p className="mt-2 text-sm text-rose-600">Could not load activity: {error.message}</p>
      </section>
    );
  }

  const rows = logs ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Activity</h2>
      <p className="mt-1 text-sm text-slate-500">Latest updates on this trip</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No activity yet. Add an expense, upload a doc, or plan an itinerary item.
        </p>
      ) : (
        <div
          className={`mt-4 ${activityListScrollAreaClass}`}
          role="region"
          aria-label="Trip activity"
        >
          <ul className="space-y-3">
            {rows.map((row) => {
              const id = row.id != null ? String(row.id) : "";
              const action = typeof row.action === "string" ? row.action : "";
              const when = formatActivityLogTime(
                typeof row.created_at === "string" ? row.created_at : undefined,
              );
              return (
                <li
                  key={id || action}
                  className="flex flex-col gap-0.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <p className="text-sm font-medium leading-snug text-slate-900">{action}</p>
                  {when ? <p className="text-xs text-slate-500">{when}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
