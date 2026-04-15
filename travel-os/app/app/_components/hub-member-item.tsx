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
  const sortedTrips = [...trips].sort((a, b) => a.localeCompare(b));
  const visibleTrips = sortedTrips.slice(0, 3);
  const remainingCount = Math.max(0, sortedTrips.length - visibleTrips.length);

  return (
    <article className="flex items-start gap-3 px-3 py-2.5">
      <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900">{name}</h3>
          <p className="flex-shrink-0 text-[11px] text-slate-500">
            {trips.length} trip{trips.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="mt-1.5 flex gap-1 overflow-x-auto whitespace-nowrap pb-0.5 [-webkit-overflow-scrolling:touch]">
          {visibleTrips.map((trip) => (
            <span
              key={`${name}-${trip}`}
              className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
            >
              {trip}
            </span>
          ))}
          {remainingCount > 0 ? (
            <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              +{remainingCount} more
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
