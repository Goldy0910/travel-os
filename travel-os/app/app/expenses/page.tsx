import HubExpenseItem from "@/app/app/_components/hub-expense-item";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { fetchTripsViaMembership } from "@/lib/trip-membership";
import { redirect } from "next/navigation";

type TripRow = {
  id: string;
  title: string | null;
  location: string | null;
};

type ExpenseRow = Record<string, string | number | null>;

function pickAmount(row: ExpenseRow) {
  const amount = row.amount;
  if (typeof amount === "number") return amount;
  if (typeof amount === "string" && amount.trim()) return Number(amount) || 0;
  const total = row.total_amount;
  if (typeof total === "number") return total;
  if (typeof total === "string" && total.trim()) return Number(total) || 0;
  return 0;
}

function formatInrCompact(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

export default async function ExpensesHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/app/login");
  }

  const { trips: tripsRaw, tripIds, error } = await fetchTripsViaMembership(supabase, user.id, {
    tripColumns: "id, title, location",
  });
  const trips = (tripsRaw ?? []) as TripRow[];
  const tripLabelById = new Map<string, string>();
  for (const trip of trips) {
    tripLabelById.set(
      trip.id,
      (trip.title && trip.title.trim()) || (trip.location && trip.location.trim()) || "Trip",
    );
  }

  const { data: expensesData } =
    tripIds.length > 0
      ? await supabase
          .from("expenses")
          .select("id, trip_id, amount, total_amount, paid_by_user_id, created_by")
          .in("trip_id", tripIds)
          .order("date", { ascending: false })
      : { data: [] as ExpenseRow[] };
  const expenses = (expensesData ?? []) as ExpenseRow[];
  const expenseIds = expenses
    .map((e) => (e.id != null ? String(e.id) : ""))
    .filter((id) => id.length > 0);

  const { data: participantRows } =
    expenseIds.length > 0
      ? await supabase
          .from("expense_participants")
          .select("expense_id, user_id, computed_amount")
          .in("expense_id", expenseIds)
      : { data: [] as ExpenseRow[] };

  const { data: memberRows } =
    tripIds.length > 0
      ? await supabase.from("members").select("trip_id, user_id, name, email").in("trip_id", tripIds)
      : { data: [] as ExpenseRow[] };
  const profileIds = Array.from(
    new Set(
      (memberRows ?? [])
        .map((row) => (row.user_id != null ? String(row.user_id) : ""))
        .filter((id) => id.length > 0),
    ),
  );
  const { data: profilesRows } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, name").in("id", profileIds)
      : { data: [] as Array<{ id: string; name: string | null }> };
  const profileNameById = new Map<string, string>();
  for (const row of profilesRows ?? []) {
    const v = typeof row.name === "string" ? row.name.trim() : "";
    if (v) profileNameById.set(String(row.id), v);
  }
  const memberLabelByUserId = new Map<string, string>();
  for (const row of memberRows ?? []) {
    const uid = row.user_id != null ? String(row.user_id) : "";
    if (!uid) continue;
    const fromProfile = profileNameById.get(uid);
    const fromMember = typeof row.name === "string" && row.name.trim() ? row.name.trim() : "";
    const fromEmail =
      typeof row.email === "string" && row.email.includes("@") ? row.email.split("@")[0] : "Member";
    memberLabelByUserId.set(uid, fromProfile || fromMember || fromEmail);
  }

  const participantByExpense = new Map<string, Array<{ userId: string; amount: number }>>();
  for (const row of participantRows ?? []) {
    const eid = row.expense_id != null ? String(row.expense_id) : "";
    const uid = row.user_id != null ? String(row.user_id) : "";
    const raw = row.computed_amount;
    const amount =
      typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) || 0 : 0;
    if (!eid || !uid) continue;
    const cur = participantByExpense.get(eid) ?? [];
    cur.push({ userId: uid, amount });
    participantByExpense.set(eid, cur);
  }

  const tripNet = new Map<string, number>();
  const tripCounterparty = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    const expenseId = expense.id != null ? String(expense.id) : "";
    const tripId = expense.trip_id != null ? String(expense.trip_id) : "";
    if (!expenseId || !tripId) continue;
    const payer =
      (expense.paid_by_user_id != null ? String(expense.paid_by_user_id) : "") ||
      (expense.created_by != null ? String(expense.created_by) : "");

    if (!payer) continue;
    const participants = participantByExpense.get(expenseId);
    if (participants && participants.length > 0) {
      for (const p of participants) {
        if (p.userId === payer) continue;
        if (p.userId === user.id) {
          const m = tripCounterparty.get(tripId) ?? new Map<string, number>();
          m.set(payer, (m.get(payer) ?? 0) - p.amount);
          tripCounterparty.set(tripId, m);
          tripNet.set(tripId, (tripNet.get(tripId) ?? 0) - p.amount);
        } else if (payer === user.id) {
          const m = tripCounterparty.get(tripId) ?? new Map<string, number>();
          m.set(p.userId, (m.get(p.userId) ?? 0) + p.amount);
          tripCounterparty.set(tripId, m);
          tripNet.set(tripId, (tripNet.get(tripId) ?? 0) + p.amount);
        }
      }
      continue;
    }

    // Fallback for legacy rows without participants.
    const amount = pickAmount(expense);
    const share = amount / 2;
    if (payer === user.id) tripNet.set(tripId, (tripNet.get(tripId) ?? 0) + (amount - share));
    else tripNet.set(tripId, (tripNet.get(tripId) ?? 0) - share);
  }

  const totals = Array.from(tripNet.values()).reduce(
    (acc, value) => {
      if (value > 0) acc.owed += value;
      if (value < 0) acc.owe += Math.abs(value);
      return acc;
    },
    { owe: 0, owed: 0 },
  );

  const rows = trips.map((trip) => {
    const tripId = trip.id;
    const net = tripNet.get(tripId) ?? 0;
    const detail = Array.from((tripCounterparty.get(tripId) ?? new Map()).entries())
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3)
      .map(([uid, amount]) => {
        const name = memberLabelByUserId.get(uid) ?? "Member";
        if (amount > 0) return `${name} owes you ${formatInrCompact(amount)}`;
        if (amount < 0) return `You owe ${name} ${formatInrCompact(amount)}`;
        return `${name} settled up`;
      });
    return {
      id: tripId,
      name: tripLabelById.get(tripId) ?? "Trip",
      net,
      detail: detail.length > 0 ? detail : ["No pending balances"],
    };
  }).sort((a, b) => {
    const az = a.net === 0 ? 1 : 0;
    const bz = b.net === 0 ? 1 : 0;
    if (az !== bz) return az - bz;
    return Math.abs(b.net) - Math.abs(a.net);
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-[calc(var(--travel-os-bottom-nav-h)+6rem)]">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-600">
            Group-style summary across all trips.
          </p>
        </div>
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs uppercase tracking-wide text-rose-700">You owe</p>
            <p className="mt-1 text-lg font-semibold text-rose-800">{formatInrCompact(totals.owe)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs uppercase tracking-wide text-emerald-700">You are owed</p>
            <p className="mt-1 text-lg font-semibold text-emerald-800">{formatInrCompact(totals.owed)}</p>
          </div>
        </section>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error.message}
          </p>
        ) : trips.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            No trips yet. Create a trip first.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              return (
                <li key={row.id}>
                  <HubExpenseItem
                    tripName={row.name}
                    netBalance={row.net}
                    breakdownLines={row.detail}
                    href={`/app/trip/${row.id}?tab=expenses`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
