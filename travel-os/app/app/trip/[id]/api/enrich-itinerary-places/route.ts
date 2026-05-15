import { enrichTripItineraryPlaces } from "@/lib/unified-trip/hydration/enrich-places";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id: tripId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const member = await isTripMember(supabase, tripId, user.id);
  if (!member) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("location, destination, city, title")
    .eq("id", tripId)
    .maybeSingle();

  const tr = (trip ?? {}) as Record<string, string | null>;
  const destination =
    String(tr.location ?? tr.destination ?? tr.city ?? tr.title ?? "").trim() ||
    "Destination";

  const result = await enrichTripItineraryPlaces(supabase, tripId, destination);

  if (result.updated > 0) {
    revalidatePath(`/app/trip/${tripId}`);
    revalidatePath(`/app/trip/${tripId}/activity`, "layout");
  }

  return NextResponse.json({ ok: true, ...result });
}
