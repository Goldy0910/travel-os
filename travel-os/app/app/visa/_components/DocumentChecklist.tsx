"use client";

import ProgressBar from "@/app/app/visa/_components/ProgressBar";
import type { TravelerType } from "@/app/app/visa/_lib/visa-data";
import { useEffect, useMemo, useState } from "react";

type DocumentChecklistProps = {
  tripId: string;
  checklistByType: Record<TravelerType, string[]>;
};

function titleCase(value: TravelerType): string {
  if (value === "self-employed") return "Self-employed";
  if (value === "salaried") return "Salaried";
  return "Student";
}

function readTravelerType(tripId: string): TravelerType {
  if (typeof window === "undefined") return "salaried";
  const raw = window.localStorage.getItem(`visa-traveler-type:${tripId}`);
  if (raw === "salaried" || raw === "self-employed" || raw === "student") return raw;
  return "salaried";
}

function readChecklist(tripId: string, travelerType: TravelerType): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(`visa-checklist:${tripId}:${travelerType}`);
  if (!raw) return {};
  try {
    return (JSON.parse(raw) as Record<string, boolean>) ?? {};
  } catch {
    return {};
  }
}

export default function DocumentChecklist({ tripId, checklistByType }: DocumentChecklistProps) {
  const [travelerType, setTravelerType] = useState<TravelerType>(() => readTravelerType(tripId));
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    readChecklist(tripId, readTravelerType(tripId)),
  );

  const checklist = checklistByType[travelerType];
  const storageKey = useMemo(
    () => `visa-checklist:${tripId}:${travelerType}`,
    [tripId, travelerType],
  );
  const storageTypeKey = useMemo(() => `visa-traveler-type:${tripId}`, [tripId]);

  useEffect(() => {
    window.localStorage.setItem(storageTypeKey, travelerType);
  }, [storageTypeKey, travelerType]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey]);

  const completed = checklist.reduce((n, item) => (checked[item] ? n + 1 : n), 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Document checklist</h2>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Traveler type</span>
        <select
          value={travelerType}
          onChange={(e) => {
            const nextType = e.target.value as TravelerType;
            setTravelerType(nextType);
            setChecked(readChecklist(tripId, nextType));
          }}
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800"
        >
          <option value="salaried">{titleCase("salaried")}</option>
          <option value="self-employed">{titleCase("self-employed")}</option>
          <option value="student">{titleCase("student")}</option>
        </select>
      </label>

      <div className="mt-4">
        <ProgressBar completed={completed} total={checklist.length} />
      </div>

      <ul className="mt-4 space-y-2">
        {checklist.map((item) => (
          <li key={item}>
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <input
                type="checkbox"
                checked={Boolean(checked[item])}
                onChange={(e) =>
                  setChecked((prev) => ({
                    ...prev,
                    [item]: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-sm text-slate-800">{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
