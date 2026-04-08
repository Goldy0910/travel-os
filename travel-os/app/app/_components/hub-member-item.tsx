type HubMemberItemProps = {
  name: string;
  trips: string[];
};

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return value.trim().slice(0, 2).toUpperCase() || "??";
}

export default function HubMemberItem({ name, trips }: HubMemberItemProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900">{name}</h3>
          <p className="text-xs text-slate-500">{trips.length} trip(s)</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {trips.map((trip) => (
          <span
            key={`${name}-${trip}`}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
          >
            {trip}
          </span>
        ))}
      </div>
    </article>
  );
}
