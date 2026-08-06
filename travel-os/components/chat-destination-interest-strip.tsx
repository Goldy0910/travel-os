"use client";

import DestinationInterestBadge from "@/components/destination-interest-badge";
import { fetchDestinationInterestBatch } from "@/lib/destination-interest/client";
import { displayInterestCount } from "@/lib/destination-interest/format";
import type { ChatDestinationInterestTarget } from "@/lib/destination-interest/from-chat";
import { useEffect, useMemo, useState } from "react";

export function ChatDestinationInterestStrip({
  targets,
}: {
  targets: ChatDestinationInterestTarget[];
}) {
  const uniqueTargets = useMemo(() => {
    const seen = new Set<string>();
    return targets.filter((target) => {
      if (!target.destinationId || seen.has(target.destinationId)) return false;
      seen.add(target.destinationId);
      return true;
    });
  }, [targets]);
  const idsKey = uniqueTargets.map((target) => target.destinationId).join(",");

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const target of uniqueTargets) {
      const count = displayInterestCount(target);
      if (count > 0) initial[target.destinationId] = count;
    }
    return initial;
  });

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    const ids = idsKey.split(",");

    const load = async () => {
      const rows = await fetchDestinationInterestBatch(ids, { bypassCache: true });
      if (cancelled) return;
      setCounts((prev) => {
        const next = { ...prev };
        for (const [id, snapshot] of rows) next[id] = displayInterestCount(snapshot);
        return next;
      });
    };

    void load();
    const retry = window.setTimeout(() => {
      void load();
    }, 900);

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
    };
  }, [idsKey]);

  if (!uniqueTargets.length) return null;

  const visible = uniqueTargets.filter((target) => (counts[target.destinationId] ?? 0) > 0);
  if (!visible.length) return null;

  return (
    <div
      className="mt-2.5 flex max-w-full flex-wrap items-center gap-2"
      data-testid="chat-destination-interest-strip"
      role="list"
      aria-label="Destination interest this month"
    >
      {visible.map((target) => (
        <div key={target.destinationId} role="listitem" className="min-w-0">
          <DestinationInterestBadge
            destinationName={target.name}
            count={counts[target.destinationId] ?? 0}
          />
        </div>
      ))}
    </div>
  );
}
