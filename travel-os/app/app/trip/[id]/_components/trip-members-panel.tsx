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
    <div className="space-y-3">
      {pageError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{pageError}</p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="border-b border-slate-100 pb-2.5">
          <h3 className="text-base font-semibold text-slate-900">Invite people</h3>
          <p className="mt-1 text-xs text-slate-600">
            Share link. Members join directly after sign-in.
          </p>
        </div>
        <div className="pt-3">
          <InviteShareBlock
            joinUrl={joinUrl}
            whatsappHref={whatsappLink}
            hasInviteCode={hasInviteCode}
            inviteCode={hasInviteCode ? inviteCode : undefined}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Trip members</h3>
          <span className="text-xs tabular-nums text-slate-500">{rows.length}</span>
        </div>

        {membersError ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Could not load members: {membersError.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No members yet. Share the invite link above.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-lg border border-slate-200">
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
                <li key={rowId || `${displayName}-${displayEmail}`} className="border-b border-slate-100 bg-white p-2.5 last:border-0">
                  <div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                          isOrganizer
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {initials}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                          </div>
                          {canInvite && rowId ? (
                            <div className="flex-shrink-0">
                              <DeleteForm
                                action={deleteMemberAction.bind(null, tripId, rowId)}
                                noun="member"
                              />
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {isOrganizer ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Organizer
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                              Member
                            </span>
                          )}
                          {pending ? (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              Pending
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{displayEmail}</p>
                        {pending ? (
                          <p className="mt-0.5 text-[11px] text-slate-500">Not in app yet.</p>
                        ) : null}
                      </div>
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
