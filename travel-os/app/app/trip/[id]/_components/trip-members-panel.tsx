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

function initialsFrom(name: string, email: string) {
  const source = name.trim() || email.trim() || "G";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
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
          <ul className="mt-4 space-y-2.5">
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
              const initials = initialsFrom(displayName, displayEmail);

              return (
                <li key={rowId || `${displayName}-${displayEmail}`}>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-3.5">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          isOrganizer
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {initials}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                          {isOrganizer ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Organizer
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              Member
                            </span>
                          )}
                          {pending ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Invite pending
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 break-all text-xs text-slate-500">{displayEmail}</p>
                        {pending ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Not in the app yet - send them the invite link.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end">
                      {canInvite && rowId ? (
                        <DeleteForm
                          action={deleteMemberAction.bind(null, tripId, rowId)}
                          noun="member"
                        />
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
