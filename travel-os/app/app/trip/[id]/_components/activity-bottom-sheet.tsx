"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";

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
  saveAction: (formData: FormData) => Promise<void>;
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

export default function ActivityBottomSheet({
  open,
  onClose,
  initial,
  formKey,
  saveAction,
}: ActivityBottomSheetProps) {
  const timeDefault = mergeTimeForInput(initial.time);

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
        <form key={formKey} action={saveAction} className="flex flex-1 flex-col gap-4">
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
              <span className="text-sm font-medium text-slate-700">Time</span>
              <input
                type="time"
                name="time"
                required
                defaultValue={timeDefault}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
              />
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
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-800 shadow-sm active:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-11 flex-1 rounded-xl bg-slate-900 py-3 text-base font-medium text-white shadow-md shadow-slate-900/20 active:bg-slate-800"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </BottomSheetModal>
  );
}
