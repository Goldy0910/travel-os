import BackLink from "@/app/app/_components/back-link";
import DeleteForm from "@/app/app/_components/delete-form";
import { getResolvedPublicSiteUrl } from "@/lib/public-site-url";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberRole, isTripMember } from "@/lib/trip-membership";
import { deleteMemberAction } from "../data-actions";
import InviteShareBlock from "./invite-share-block";
import Link from "next/link";
import { redirect } from "next/navigation";

type MembersPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type GenericRecord = Record<string, string | number | null>;

function pickFirstString(
  record: GenericRecord,
  keys: string[],
  fallback: string,
) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return fallback;
}

export default async function TripMembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const errorParam = query.error;
  const error =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const member = await isTripMember(supabase, tripId, user.id);
  if (!member) {
    redirect("/app/home");
  }

  const { data: tripData } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!tripData) {
    redirect("/app/home");
  }

  const trip = tripData as GenericRecord;
  const tripTitle = pickFirstString(trip, ["title", "name", "trip_name"], "Trip");
  const inviteCode = pickFirstString(trip, ["invite_code"], "").trim();
  const myRole = await getMemberRole(supabase, tripId, user.id);
  const canInvite = myRole === "organizer";

  const { data: membersData, error: membersError } = await supabase
    .from("members")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });

  const rows = (membersData ?? []) as GenericRecord[];

  const baseUrl = await getResolvedPublicSiteUrl();
  const hasInviteCode = inviteCode.length > 0;
  const joinUrl = hasInviteCode
    ? `${baseUrl}/join?code=${encodeURIComponent(inviteCode)}`
    : `${baseUrl}/join`;
  const whatsappText = hasInviteCode
    ? `Join my trip: ${joinUrl}`
    : `Join my trip on Travel OS: ${joinUrl}`;
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink href="/app/trips">All trips</BackLink>
          <BackLink href="/app/home">Home</BackLink>
        </div>

        <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-sm text-slate-300">Trip members</p>
          <h1 className="mt-1 text-2xl font-semibold">{tripTitle}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/app/trip/${tripId}`}
              className="inline-block rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
            >
              ← Trip overview
            </Link>
          </div>
        </section>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/60">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">Invite people</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Share this link. They&apos;ll sign in (or sign up) and land in the trip automatically —
              no separate accept step.
            </p>
          </div>
          <div className="pt-5">
            <InviteShareBlock
              joinUrl={joinUrl}
              whatsappHref={whatsappLink}
              hasInviteCode={hasInviteCode}
              inviteCode={hasInviteCode ? inviteCode : undefined}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Who&apos;s on the trip</h2>
            <span className="text-sm tabular-nums text-slate-500">{rows.length}</span>
          </div>

          {membersError ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Could not load members: {membersError.message}
            </p>
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              No members yet. Share the invite link above.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {rows.map((m) => {
                const rowId = m.id != null && m.id !== "" ? String(m.id) : "";
                const rawName = pickFirstString(m, ["name"], "");
                const email = typeof m.email === "string" ? m.email.trim() : "";
                const pending = m.user_id == null;
                const displayName =
                  rawName && rawName !== email
                    ? rawName
                    : email
                      ? email.split("@")[0] || "Guest"
                      : "Guest";
                const displayEmail = email || "—";
                const roleRaw = pickFirstString(m, ["role"], "member").toLowerCase();
                const isOrganizer = roleRaw === "organizer";

                return (
                  <li key={rowId || `${displayName}-${displayEmail}`} className="py-4 first:pt-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Name
                        </p>
                        <p className="truncate text-base font-semibold text-slate-900">
                          {displayName}
                        </p>
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                          Email
                        </p>
                        <p className="break-all text-sm text-slate-600">{displayEmail}</p>
                        {pending ? (
                          <p className="text-xs text-slate-500">
                            Not in the app yet — send them the invite link.
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400 sm:text-right">
                          Role
                        </p>
                        {isOrganizer ? (
                          <span className="inline-flex w-fit items-center rounded-xl border-2 border-emerald-500/80 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 shadow-sm shadow-emerald-900/5">
                            Organizer
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                            Member
                          </span>
                        )}
                        {canInvite && rowId ? (
                          <div className="pt-1 sm:flex sm:justify-end">
                            <DeleteForm
                              action={deleteMemberAction.bind(null, tripId, rowId)}
                              noun="member"
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
