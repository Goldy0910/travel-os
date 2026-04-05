import DeleteForm from "@/app/app/_components/delete-form";
import { deleteMemberAction } from "../data-actions";
import InviteShareBlock from "@/app/app/trip/[id]/members/invite-share-block";

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

export type TripMembersPanelProps = {
  tripId: string;
  tripTitle: string;
  pageError: string;
  inviteCode: string;
  canInvite: boolean;
  joinUrl: string;
  whatsappLink: string;
  hasInviteCode: boolean;
  rows: GenericRecord[];
  membersError: { message: string } | null;
};

export default function TripMembersPanel({
  tripId,
  tripTitle,
  pageError,
  inviteCode,
  canInvite,
  joinUrl,
  whatsappLink,
  hasInviteCode,
  rows,
  membersError,
}: TripMembersPanelProps) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-sm text-slate-300">Trip members</p>
        <h2 className="mt-1 text-2xl font-semibold">{tripTitle}</h2>
      </section>

      {pageError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{pageError}</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md shadow-slate-200/60">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-lg font-semibold text-slate-900">Invite people</h3>
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
          <h3 className="text-lg font-semibold text-slate-900">Who&apos;s on the trip</h3>
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
  );
}
