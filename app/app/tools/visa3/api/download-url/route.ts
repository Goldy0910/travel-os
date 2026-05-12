import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const DOCS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";

type DownloadRequest = {
  storagePath?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: DownloadRequest;
  try {
    body = (await req.json()) as DownloadRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const storagePath = String(body.storagePath ?? "").trim();
  if (!storagePath) return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
  const signed = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (!signed.data?.signedUrl) return NextResponse.json({ error: "Could not create signed URL" }, { status: 500 });
  return NextResponse.json({ signedUrl: signed.data.signedUrl });
}
