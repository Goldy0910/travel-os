"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import { updateTripDetailsAction } from "../data-actions";
import { useCallback } from "react";

export type TripEditDefaults = {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
};

const EMPTY_TRIP_EDIT_DEFAULTS: TripEditDefaults = {
  title: "",
  location: "",
  startDate: "",
  endDate: "",
};

type TripUpdateBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  tripId: string;
  defaults?: TripEditDefaults;
  formKey: string;
};

export default function TripUpdateBottomSheet({
  open,
  onClose,
  tripId,
  defaults,
  formKey,
}: TripUpdateBottomSheetProps) {
  const d = defaults ?? EMPTY_TRIP_EDIT_DEFAULTS;
  const saveAction = useCallback(
    (fd: FormData) => updateTripDetailsAction(tripId, fd),
    [tripId],
  );

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title="Update trip"
      description="Title, destination, and travel dates."
      panelClassName="max-h-[75vh]"
      titleId="trip-update-sheet-title"
    >
      <form key={formKey} action={saveAction} className="flex flex-col gap-4 pb-1">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Trip title</span>
          <input
            name="title"
            required
            defaultValue={d.title}
            placeholder="e.g. Summer in Japan"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Location</span>
          <input
            name="location"
            required
            defaultValue={d.location}
            placeholder="City or region"
            className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Start date</span>
            <input
              name="startDate"
              type="date"
              required
              defaultValue={d.startDate}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">End date</span>
            <input
              name="endDate"
              type="date"
              required
              defaultValue={d.endDate}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
            />
          </label>
        </div>

        <div className="mt-2 flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-800 shadow-sm active:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-xl bg-slate-900 py-3 text-base font-medium text-white shadow-md shadow-slate-900/20"
          >
            Save
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
}
