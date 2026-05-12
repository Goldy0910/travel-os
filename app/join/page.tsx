import { createSupabaseServerClient } from "@/lib/supabase-server";
import { tripIdFromJson } from "@/lib/trip-id-from-json";
import JoinInviteClient, {
  type InvitePreviewPayload,
} from "./join-invite-client";
import { redirect } from "next/navigation";

type JoinPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function asPreview(data: unknown): InvitePreviewPayload {
  if (!data || typeof data !== "object") return { found: false };
  const o = data as Record<string, unknown>;
  if (o.found !== true) return { found: false };
  return {
    found: true,
    trip_id: tripIdFromJson(o.trip_id),
    title: typeof o.title === "string" ? o.title : undefined,
    location: typeof o.location === "string" ? o.location : undefined,
  };
}

function asJoinResult(data: unknown): {
  ok: boolean;
  trip_id?: string;
  error?: string;
} {
  if (!data || typeof data !== "object") return { ok: false, error: "Unexpected response" };
  const o = data as Record<string, unknown>;
  return {
    ok: o.ok === true,
    trip_id: tripIdFromJson(o.trip_id),
    error: typeof o.error === "string" ? o.error : undefined,
  };
}

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = (await searchParams) ?? {};
  const raw = params.code;
  const code =
    typeof raw === "string" ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? "").trim() : "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let preview: InvitePreviewPayload = { found: false };
  let serverJoinError: string | null = null;

  if (code.length >= 8) {
    const { data: previewData, error: previewErr } = await supabase.rpc(
      "get_trip_by_invite_code",
      { p_code: code },
    );
    if (previewErr) {
      preview = { found: false };
      serverJoinError = previewErr.message;
    } else {
      preview = asPreview(previewData);
    }
  }

  if (user && code.length >= 8 && preview.found) {
    const { data: joinData, error: joinErr } = await supabase.rpc(
      "join_trip_by_invite_code",
      { p_code: code },
    );
    if (joinErr) {
      serverJoinError = joinErr.message;
    } else {
      const jr = asJoinResult(joinData);
      if (jr.ok) {
        const tripId = jr.trip_id ?? preview.trip_id;
        if (tripId) {
          redirect(`/app/trip/${tripId}?welcome=1`);
        }
        serverJoinError =
          jr.error ?? "Could not complete join. Try again or contact support.";
      } else {
        serverJoinError =
          jr.error === "invalid_code"
            ? "This invite is no longer valid."
            : jr.error === "not_authenticated"
              ? "Please log in to join."
              : jr.error ?? "Could not join this trip.";
      }
    }
  }

  return (
    <JoinInviteClient
      initialCode={code}
      preview={preview}
      isLoggedIn={!!user}
      serverJoinError={serverJoinError}
    />
  );
}
