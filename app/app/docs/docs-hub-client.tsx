"use client";

import { useMemo, useState } from "react";
import HubDocItem from "@/app/app/_components/hub-doc-item";

export type DocsHubItem = {
  id: string;
  fileName: string;
  fileTypeLabel: string;
  fileUrl: string | null;
  tripId: string;
  tripLabel: string;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string | null;
  href: string;
};

type DocsHubClientProps = {
  items: DocsHubItem[];
  trips: Array<{ id: string; label: string }>;
};

export default function DocsHubClient({ items, trips }: DocsHubClientProps) {
  const [search, setSearch] = useState("");
  const [tripFilter, setTripFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((item) => (tripFilter === "all" ? true : item.tripId === tripFilter))
      .filter((item) => (q.length === 0 ? true : item.fileName.toLowerCase().includes(q)))
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
  }, [items, search, tripFilter]);

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search file name"
          className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
        <select
          value={tripFilter}
          onChange={(e) => setTripFilter(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        >
          <option value="all">All trips</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          No matching documents.
        </div>
      ) : (
        <ul className="min-w-0 space-y-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <HubDocItem
                fileName={item.fileName}
                fileTypeLabel={item.fileTypeLabel}
                fileUrl={item.fileUrl}
                tripLabel={item.tripLabel}
                uploadedBy={item.uploadedBy}
                uploadedAt={item.uploadedAt}
                href={item.href}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
