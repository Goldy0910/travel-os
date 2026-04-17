import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isTripMember } from "@/lib/trip-membership";
import {
  enumerateTripDates,
  extractPdfItineraryDraft,
} from "@/app/app/trip/[id]/_lib/itinerary-bootstrap-ai";
import { extractYMD } from "@/lib/itinerary-trip-range";

function pickFirstTripDateValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const raw = row[key];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return "";
}

function normalizeTripDateInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const ymd = extractYMD(trimmed);
  if (ymd) return ymd;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: tripId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isTripMember(supabase, tripId, user.id);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const fd = await request.formData();
  const file = fd.get("itineraryPdf");
  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ ok: false, error: "Please upload a PDF file." }, { status: 400 });
  }

  const { data: trip } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
  const row = (trip ?? {}) as Record<string, unknown>;
  const startDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["start_date", "startDate", "date_from"]),
  );
  const endDate = normalizeTripDateInput(
    pickFirstTripDateValue(row, ["end_date", "endDate", "date_to"]),
  );
  const tripDates = enumerateTripDates(startDate, endDate);
  if (tripDates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Trip dates are invalid. Please update trip dates first." },
      { status: 400 },
    );
  }

  try {
    const arr = new Uint8Array(await file.arrayBuffer());
    const pdfBase64 = Buffer.from(arr).toString("base64");
    const activities = await extractPdfItineraryDraft({ pdfBase64, tripDates });
    return NextResponse.json({
      ok: true,
      activities: activities.slice(0, 80),
      total: activities.length,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Unknown extraction error";
    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV !== "production"
            ? `Couldn't extract itinerary clearly. Please review or add manually. (${reason})`
            : "Couldn't extract itinerary clearly. Please review or add manually.",
      },
      { status: 422 },
    );
  }
}
