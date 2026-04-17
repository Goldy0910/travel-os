type TimelineCardProps = {
  tripStartDate: string;
};

function parseYmd(raw: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(`${m[1]}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default function TimelineCard({ tripStartDate }: TimelineCardProps) {
  const tripStart = parseYmd(tripStartDate);
  const now = new Date();

  if (!tripStart) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Visa timeline planner</h2>
        <p className="mt-2 text-sm text-slate-600">Add a trip start date to see visa timeline guidance.</p>
      </section>
    );
  }

  const applyBy = new Date(tripStart);
  applyBy.setDate(applyBy.getDate() - 30);
  const daysLeft = Math.ceil((applyBy.getTime() - now.getTime()) / 86400000);
  const tooClose = daysLeft < 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Visa timeline planner</h2>
      <p className="mt-2 text-sm text-slate-700">Apply at least 30 days before travel.</p>
      <div className="mt-3 rounded-xl bg-indigo-50 px-3 py-3">
        <p className="text-xs uppercase tracking-wide text-indigo-700">Recommended apply-by date</p>
        <p className="mt-1 text-lg font-semibold text-indigo-900">{formatDate(applyBy)}</p>
      </div>
      {tooClose ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          Your travel date is close. Start visa filing immediately.
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          You still have <span className="font-semibold text-slate-900">{daysLeft} day(s)</span> before the suggested apply date.
        </p>
      )}
    </section>
  );
}
