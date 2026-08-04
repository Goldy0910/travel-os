import { formatActivityLogTime, fetchTripActivityLogs } from "@/lib/activity-log";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Clock3 } from "lucide-react";

type TripActivityFeedProps = {
  tripId: string;
};

/**
 * Server-rendered trip activity log. It stays hidden until there is activity
 * to display, keeping the itinerary view focused for a newly created trip.
 */
export default async function TripActivityFeed({ tripId }: TripActivityFeedProps) {
  const supabase = await createSupabaseServerClient();
  const { data: activity, error } = await fetchTripActivityLogs(supabase, tripId);

  if (error || !activity?.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-slate-500" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
      </div>
      <ul className="mt-3 divide-y divide-slate-100">
        {activity.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <p className="min-w-0 text-sm leading-relaxed text-slate-700">{item.action}</p>
            <time
              dateTime={item.created_at ?? undefined}
              className="shrink-0 text-xs text-slate-400"
            >
              {formatActivityLogTime(item.created_at)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}
