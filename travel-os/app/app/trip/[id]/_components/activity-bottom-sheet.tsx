"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import type { FormActionResult } from "@/lib/form-action-result";
import { useEffect, useMemo, useState } from "react";

export type ActivitySheetInitial = {
  itemId?: string;
  activityName: string;
  location: string;
  time: string;
  date: string;
};

type ActivityBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  initial: ActivitySheetInitial;
  formKey: string;
  saveAction: (formData: FormData) => Promise<FormActionResult>;
};

function mergeTimeForInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d{2}:\d{2}$/.test(t)) return t;
  const m12 = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(t);
  if (m12) {
    let h = Number(m12[1]);
    const min = m12[2];
    const ap = m12[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  return "";
}

function to12hLabel(time24: string): string {
  if (!/^\d{2}:\d{2}$/.test(time24)) return "No time selected";
  const [hhRaw, mm] = time24.split(":");
  const hh = Number(hhRaw);
  if (!Number.isFinite(hh)) return "No time selected";
  const suffix = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${mm} ${suffix}`;
}

const QUICK_TIMES: Array<{ label: string; value: string }> = [
  { label: "8:00 AM", value: "08:00" },
  { label: "10:00 AM", value: "10:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "7:00 PM", value: "19:00" },
  { label: "9:00 PM", value: "21:00" },
];

export default function ActivityBottomSheet({
  open,
  onClose,
  initial,
  formKey,
  saveAction,
}: ActivityBottomSheetProps) {
  const timeDefault = mergeTimeForInput(initial.time);
  const { pending, handleForm } = useFormActionFeedback();
  const [timeValue, setTimeValue] = useState(timeDefault);

  useEffect(() => {
    setTimeValue(timeDefault);
  }, [timeDefault, formKey, open]);

  const timeReadable = useMemo(() => to12hLabel(timeValue), [timeValue]);

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title={initial.itemId ? "Update activity" : "New activity"}
      description="Add details for your itinerary."
      titleId="activity-sheet-title"
      panelClassName="max-h-[70vh] min-h-[min(70vh,520px)]"
    >
      <div className="flex min-h-[min(65vh,480px)] flex-col">
        <form
          key={formKey}
          onSubmit={(e) => handleForm(e, saveAction, onClose)}
          className="flex flex-1 flex-col gap-4"
        >
          {initial.itemId ? <input type="hidden" name="itemId" value={initial.itemId} /> : null}

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Activity name</span>
            <input
              name="activityName"
              required
              defaultValue={initial.activityName}
              placeholder="e.g. Museum visit"
              autoComplete="off"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none ring-slate-900/0 transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Location</span>
            <input
              name="location"
              required
              defaultValue={initial.location}
              placeholder="Address or place"
              autoComplete="street-address"
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Time{" "}
                <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {QUICK_TIMES.map((option) => {
                  const active = timeValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTimeValue(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setTimeValue("")}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition"
                >
                  Clear
                </button>
              </div>
              <input
                type="time"
                name="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              />
              <p className="mt-1 text-xs text-slate-500">{timeReadable}</p>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Date</span>
              <input
                type="date"
                name="date"
                required
                defaultValue={initial.date}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
          </div>

          <div className="mt-auto flex shrink-0 gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-800 shadow-sm active:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-base font-medium text-white shadow-md shadow-slate-900/20 active:bg-slate-800 disabled:opacity-60"
            >
              {pending ? (
                <>
                  <ButtonSpinner className="h-4 w-4 text-white" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </BottomSheetModal>
  );
}
