import { isMissingSavedPlacesTable } from "@/lib/saved-places/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ placeId: string }> };

/** DELETE /api/saved-places/[placeId] — unsave. */
export async function DELETE(_req: Request, { params }: Params) {
  const { placeId: raw } = await params;
  const placeId = decodeURIComponent(raw || "").trim();
  if (!placeId) {
    return NextResponse.json({ ok: false, error: "Missing placeId" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("saved_places")
    .delete()
    .eq("user_id", user.id)
    .eq("place_id", placeId);

  if (error) {
    if (isMissingSavedPlacesTable(error)) {
      return NextResponse.json(
        { ok: false, error: "Apply saved_places migration", migrationPending: true },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
