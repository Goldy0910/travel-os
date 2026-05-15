"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import RefinementChatPanel from "@/app/app/master-trip/_components/refinement-chat-panel";
import ShareTripSheet from "@/app/components/share/share-trip-sheet";
import { updateMasterTripSectionAction } from "@/app/app/master-trip/actions";
import type { MasterItineraryDay, MasterTripFile } from "@/lib/master-trip-file";
import {
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  MapPin,
  Route,
  Share2,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  masterId: string;
  tripId: string | null;
  version: number;
  file: MasterTripFile;
  updatedAt: string;
};

export default function MasterTripClient({
  masterId,
  tripId,
  version: initialVersion,
  file: initialFile,
  updatedAt,
}: Props) {
  const { pending, runAction } = useFormActionFeedback();
  const [version, setVersion] = useState(initialVersion);
  const [file, setFile] = useState(initialFile);
  const [editing, setEditing] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set());
  const [shareOpen, setShareOpen] = useState(false);

  const [whyDraft, setWhyDraft] = useState(file.recommendation.whyItFits.join("\n"));
  const [itineraryDraft, setItineraryDraft] = useState(file.itinerary);
  const [practicalDraft, setPracticalDraft] = useState(file.practical);

  const toggleDay = (id: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveSection = (section: string, build: (fd: FormData) => void) => {
    const fd = new FormData();
    fd.set("masterId", masterId);
    fd.set("expectedVersion", String(version));
    fd.set("section", section);
    build(fd);
    runAction(() => updateMasterTripSectionAction(fd), () => {
      setEditing(null);
      window.location.reload();
    });
  };

  const handleFileUpdate = (updater: (prev: MasterTripFile) => MasterTripFile) => {
    setFile(updater);
  };

  useEffect(() => {
    setWhyDraft(file.recommendation.whyItFits.join("\n"));
    setItineraryDraft(file.itinerary);
    setPracticalDraft(file.practical);
  }, [file]);

  const updatedLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(updatedAt));

  return (
    <div className="min-w-0 bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+6rem)]">
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-5">
        {/* Recommendation summary */}
        <section className="overflow-hidden rounded-3xl border border-teal-100 bg-white p-5 shadow-md shadow-teal-900/5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
            Recommendation summary
          </p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
            <MapPin className="h-6 w-6 text-teal-600" aria-hidden />
            {file.destination.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{file.destination.canonicalLocation}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {file.preferences.days} days
            </span>
            {file.preferences.budget ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                {file.preferences.budget}
              </span>
            ) : null}
            {file.preferences.priorities.slice(0, 3).map((p) => (
              <span
                key={p}
                className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-800"
              >
                {p.replace("-", " ")}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            {file.recommendation.explanation}
          </p>
          <p className="mt-2 text-xs text-slate-400">Updated {updatedLabel}</p>
        </section>

        {/* Why this fits */}
        <EditableSection
          title="Why this fits"
          editing={editing === "why"}
          onEdit={() => setEditing("why")}
          onCancel={() => {
            setWhyDraft(file.recommendation.whyItFits.join("\n"));
            setEditing(null);
          }}
        >
          {editing === "why" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSection("whyItFits", (fd) => {
                  fd.set("whyItFits", whyDraft);
                });
              }}
              className="space-y-3"
            >
              <textarea
                value={whyDraft}
                onChange={(e) => setWhyDraft(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
              />
              <SaveRow pending={pending} />
            </form>
          ) : (
            <ul className="space-y-2">
              {file.recommendation.whyItFits.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </EditableSection>

        {/* Itinerary */}
        <EditableSection
          title="Itinerary"
          editing={editing === "itinerary"}
          onEdit={() => setEditing("itinerary")}
          onCancel={() => {
            setItineraryDraft(file.itinerary);
            setEditing(null);
          }}
        >
          {editing === "itinerary" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSection("itinerary", (fd) => {
                  fd.set("itinerary", JSON.stringify(itineraryDraft));
                });
              }}
              className="space-y-3"
            >
              {itineraryDraft.map((day, idx) => (
                <div key={day.id} className="rounded-xl border border-slate-200 p-3">
                  <label className="text-xs font-medium text-slate-500">Day {day.dayNumber}</label>
                  <input
                    value={day.summary}
                    onChange={(e) => {
                      const next = [...itineraryDraft];
                      next[idx] = { ...day, summary: e.target.value };
                      setItineraryDraft(next);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <SaveRow pending={pending} />
            </form>
          ) : (
            <ol className="space-y-2">
              {file.itinerary.map((day) => {
                const open = expandedDays.has(day.id);
                return (
                  <li
                    key={day.id}
                    className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/80"
                  >
                    <button
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left touch-manipulation"
                    >
                      <span className="font-semibold text-slate-900">{day.title}</span>
                      {open ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    {open ? (
                      <p className="border-t border-slate-100 px-4 pb-3 text-sm text-slate-600">
                        {day.summary}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </EditableSection>

        {/* Practical snapshot */}
        <EditableSection
          title="Practical snapshot"
          editing={editing === "practical"}
          onEdit={() => setEditing("practical")}
          onCancel={() => {
            setPracticalDraft(file.practical);
            setEditing(null);
          }}
        >
          {editing === "practical" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSection("practical", (fd) => {
                  fd.set("travelEffort", practicalDraft.travelEffort);
                  fd.set("budgetEstimate", practicalDraft.budgetEstimate);
                  fd.set("timeFit", practicalDraft.timeFit ?? "");
                  fd.set("practicality", practicalDraft.practicality ?? "");
                });
              }}
              className="space-y-3"
            >
              <Field label="Travel effort" value={practicalDraft.travelEffort} onChange={(v) => setPracticalDraft({ ...practicalDraft, travelEffort: v })} />
              <Field label="Budget" value={practicalDraft.budgetEstimate} onChange={(v) => setPracticalDraft({ ...practicalDraft, budgetEstimate: v })} />
              <SaveRow pending={pending} />
            </form>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Snapshot label="Travel effort" icon={Route} value={file.practical.travelEffort} />
              <Snapshot label="Budget" icon={Calendar} value={file.practical.budgetEstimate} />
            </div>
          )}
        </EditableSection>

        <section className="rounded-3xl border border-dashed border-teal-200 bg-teal-50/40 p-4">
          <p className="text-sm font-medium text-teal-900">Conversational refinement</p>
          <p className="mt-1 text-xs text-teal-800/90">
            Use the chat button — we patch only what you ask, not the whole trip.
          </p>
          {file.refinementHistory.length > 0 ? (
            <p className="mt-2 text-xs text-teal-700">
              {file.refinementHistory.length} refinement
              {file.refinementHistory.length === 1 ? "" : "s"} in history
            </p>
          ) : null}
        </section>
      </div>

      <RefinementChatPanel
        masterId={masterId}
        version={version}
        file={file}
        onVersionChange={setVersion}
        onFileUpdate={handleFileUpdate}
      />

      <ShareTripSheet
        masterId={masterId}
        file={file}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      />

      {/* Sticky actions */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[var(--travel-os-bottom-nav-h)] z-[100] px-4 pb-3">
        <div className="pointer-events-auto mx-auto flex max-w-lg gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-md">
          {tripId ? (
            <Link
              href={`/app/trip/${encodeURIComponent(tripId)}?tab=itinerary`}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white touch-manipulation"
            >
              <Bookmark className="h-4 w-4" />
              Open full trip
            </Link>
          ) : (
            <Link
              href="/app/create-trip"
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white touch-manipulation"
            >
              Link to trip
            </Link>
          )}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 text-sm font-semibold text-teal-900 touch-manipulation"
          >
            <Share2 className="h-4 w-4" aria-hidden />
            Share
          </button>
          <Link
            href="/app/trips"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 touch-manipulation"
          >
            All trips
          </Link>
        </div>
      </div>
    </div>
  );
}

function EditableSection({
  title,
  children,
  editing,
  onEdit,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {editing ? (
          <button type="button" onClick={onCancel} className="text-sm font-medium text-slate-500">
            Cancel
          </button>
        ) : (
          <button type="button" onClick={onEdit} className="text-sm font-semibold text-teal-700">
            Edit
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SaveRow({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? <ButtonSpinner className="h-4 w-4 text-white" /> : null}
      Save section
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function Snapshot({
  label,
  icon: Icon,
  value,
}: {
  label: string;
  icon: typeof Route;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
