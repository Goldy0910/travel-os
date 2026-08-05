import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DestinationInterestMonthlyRow,
  DestinationInterestPeriod,
  DestinationInterestStore,
  TrackDestinationInterestInput,
} from "@/lib/destination-interest/types";

function asMonthlyRow(row: Record<string, unknown>): DestinationInterestMonthlyRow | null {
  const destinationId = typeof row.destination_id === "string" ? row.destination_id : "";
  const year = typeof row.year === "number" ? row.year : Number(row.year);
  const month = typeof row.month === "number" ? row.month : Number(row.month);
  if (!destinationId || !Number.isFinite(year) || !Number.isFinite(month)) return null;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    destination_id: destinationId,
    year,
    month,
    unique_travelers: num(row.unique_travelers),
    search_count: num(row.search_count),
    ai_recommendation_count: num(row.ai_recommendation_count),
    detail_view_count: num(row.detail_view_count),
    trip_add_count: num(row.trip_add_count),
    favorite_count: num(row.favorite_count),
    total_interest: num(row.total_interest),
  };
}

export class SupabaseDestinationInterestStore implements DestinationInterestStore {
  constructor(private readonly supabase: SupabaseClient) {}

  async track(input: TrackDestinationInterestInput): Promise<{ newUniqueTraveler: boolean } | null> {
    const { data, error } = await this.supabase.rpc("track_destination_interest", {
      p_destination_id: input.destinationId,
      p_event_type: input.eventType,
      p_actor_id: input.actorId,
    });
    if (error) throw error;
    const payload = data && typeof data === "object" ? (data as { newUniqueTraveler?: boolean }) : null;
    return { newUniqueTraveler: Boolean(payload?.newUniqueTraveler) };
  }

  async getMonthly(
    destinationId: string,
    period: DestinationInterestPeriod,
  ): Promise<DestinationInterestMonthlyRow | null> {
    const { data, error } = await this.supabase
      .from("destination_interest_monthly")
      .select(
        "destination_id, year, month, unique_travelers, search_count, ai_recommendation_count, detail_view_count, trip_add_count, favorite_count, total_interest",
      )
      .eq("destination_id", destinationId)
      .eq("year", period.year)
      .eq("month", period.month)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return asMonthlyRow(data as Record<string, unknown>);
  }

  async getMonthlyBatch(
    destinationIds: string[],
    period: DestinationInterestPeriod,
  ): Promise<DestinationInterestMonthlyRow[]> {
    if (!destinationIds.length) return [];
    const { data, error } = await this.supabase
      .from("destination_interest_monthly")
      .select(
        "destination_id, year, month, unique_travelers, search_count, ai_recommendation_count, detail_view_count, trip_add_count, favorite_count, total_interest",
      )
      .in("destination_id", destinationIds)
      .eq("year", period.year)
      .eq("month", period.month);
    if (error) throw error;
    return (data ?? [])
      .map((row) => asMonthlyRow(row as Record<string, unknown>))
      .filter((row): row is DestinationInterestMonthlyRow => row != null);
  }
}
