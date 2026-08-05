import "server-only";

import { DestinationInterestService } from "@/lib/destination-interest/service";
import { SupabaseDestinationInterestStore } from "@/lib/destination-interest/supabase-store";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function createDestinationInterestService(): Promise<DestinationInterestService> {
  const supabase = await createSupabaseServerClient();
  return new DestinationInterestService(new SupabaseDestinationInterestStore(supabase));
}
