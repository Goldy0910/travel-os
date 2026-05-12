import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg"];

function safeSegment(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-");
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const tripId = String(form.get("tripId") ?? "").trim();
  const documentName = String(form.get("documentName") ?? "").trim();
  const file = form.get("file");
  if (!tripId || !documentName || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing tripId, documentName, or file" }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PDF/JPG files are supported" }, { status: 400 });
  }

  const ext = file.type === "application/pdf" ? "pdf" : "jpg";
  const path = `visa3/${safeSegment(user.id)}/${safeSegment(tripId)}/${Date.now()}-${safeSegment(documentName)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (error) return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  return NextResponse.json({ storagePath: path });
}
