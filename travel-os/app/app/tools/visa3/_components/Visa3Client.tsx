"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { COUNTRY_OPTIONS, findCountryByName } from "@/app/app/tools/_lib/countries";
import type {
  TripVisa3Option,
  VisaAlert,
  VisaAlertsResponse,
  VisaDocumentDetail,
  VisaLookupResponse,
  VisaTypeId,
} from "@/app/app/tools/visa3/_lib/types";
import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";

const PASSPORT_STORAGE_KEY = "travel-os-visa3-passport-country";
const EXPIRY_STORAGE_KEY = "travel-os-visa3-passport-expiry";
const REMINDER_PREFIX = "travel-os-visa3-reminder";
const CHECKLIST_PREFIX = "travel-os-visa3-checklist";
const UPLOADS_PREFIX = "travel-os-visa3-uploads";

type TabKey = "guide" | "documents" | "alerts";
type ReminderOffset = 30 | 15 | 7;

type UploadState = Record<string, { storagePath: string; fileName: string }>;

type Props = {
  trips: TripVisa3Option[];
  defaultTripId: string;
  defaultPassportCountry: string;
};

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-3 py-6" role="status" aria-busy="true">
      <ButtonSpinner className="h-8 w-8 shrink-0 text-indigo-600" />
      <p className="max-w-[280px] text-center text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Dates not set";
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function applyByDate(startDate: string, processingDays: number): Date | null {
  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() - (processingDays + 7) * 24 * 60 * 60 * 1000);
}

function countdownTone(daysLeft: number): string {
  if (daysLeft > 30) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (daysLeft >= 15) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
}

function severityTone(severity: VisaAlert["severity"]): string {
  if (severity === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (severity === "warning") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function compactTripOptionLabel(trip: TripVisa3Option): string {
  const title = trip.title.trim();
  const shortTitle = title.length > 24 ? `${title.slice(0, 24)}…` : title;
  return `${shortTitle} · ${trip.flagEmoji} · ${formatDateRange(trip.startDate, trip.endDate)}`;
}

function formatSignedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function visaTypeTone(typeId: VisaTypeId): string {
  if (typeId === "visa-free") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (typeId === "visa-on-arrival") return "border-sky-200 bg-sky-50 text-sky-800";
  if (typeId === "e-visa") return "border-indigo-200 bg-indigo-50 text-indigo-800";
  return "border-rose-200 bg-rose-50 text-rose-800";
}

export default function Visa3Client({ trips, defaultTripId, defaultPassportCountry }: Props) {
  const [tripId, setTripId] = useState(defaultTripId);
  const [passportCountry, setPassportCountry] = useState(defaultPassportCountry || "India");
  const [passportExpiryDate, setPassportExpiryDate] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("guide");
  const [lookup, setLookup] = useState<VisaLookupResponse | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [selectedVisaType, setSelectedVisaType] = useState<VisaTypeId | "">("");
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [uploadedDocs, setUploadedDocs] = useState<UploadState>({});
  const [uploadBusyByDoc, setUploadBusyByDoc] = useState<Record<string, boolean>>({});
  const [alertsData, setAlertsData] = useState<VisaAlertsResponse | null>(null);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState("");
  const [lookupReloadSeed, setLookupReloadSeed] = useState(0);
  const [reminderOffset, setReminderOffset] = useState<ReminderOffset | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [rejectionOpen, setRejectionOpen] = useState(false);

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === tripId) ?? trips[0], [trips, tripId]);
  const reminderKey = `${REMINDER_PREFIX}:${tripId}:${passportCountry.toLowerCase()}`;
  const checklistKey = `${CHECKLIST_PREFIX}:${tripId}:${passportCountry.toLowerCase()}`;
  const uploadsKey = `${UPLOADS_PREFIX}:${tripId}:${passportCountry.toLowerCase()}`;
  const selectedOption = useMemo(
    () => lookup?.visaOptions.find((item) => item.id === selectedVisaType) ?? null,
    [lookup, selectedVisaType],
  );

  useEffect(() => {
    const stored = localStorage.getItem(PASSPORT_STORAGE_KEY);
    if (stored && findCountryByName(stored)) setPassportCountry(stored);
    if (defaultPassportCountry) setPassportCountry(defaultPassportCountry);
    setPassportExpiryDate(localStorage.getItem(EXPIRY_STORAGE_KEY) ?? "");
  }, [defaultPassportCountry]);

  useEffect(() => localStorage.setItem(PASSPORT_STORAGE_KEY, passportCountry), [passportCountry]);
  useEffect(() => localStorage.setItem(EXPIRY_STORAGE_KEY, passportExpiryDate), [passportExpiryDate]);

  useEffect(() => {
    setCheckedItems(JSON.parse(localStorage.getItem(checklistKey) ?? "{}") as Record<string, boolean>);
    setUploadedDocs(JSON.parse(localStorage.getItem(uploadsKey) ?? "{}") as UploadState);
    const savedReminder = localStorage.getItem(reminderKey);
    if (savedReminder === "30" || savedReminder === "15" || savedReminder === "7") {
      setReminderOffset(Number(savedReminder) as ReminderOffset);
    } else {
      setReminderOffset(null);
    }
  }, [checklistKey, reminderKey, uploadsKey]);

  useEffect(() => {
    if (!selectedTrip) return;
    let cancelled = false;
    const run = async () => {
      setLookupLoading(true);
      setLookupError("");
      try {
        const response = await fetch("/app/tools/visa3/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationCountry: selectedTrip.destinationCountry,
            passportCountry,
          }),
        });
        if (!response.ok) throw new Error("Lookup request failed");
        const data = (await response.json()) as VisaLookupResponse;
        if (!cancelled) {
          setLookup(data);
          const defaultType = data.visaOptions[0]?.id ?? "";
          setSelectedVisaType((current) =>
            current && data.visaOptions.some((v) => v.id === current) ? current : defaultType,
          );
        }
      } catch {
        if (!cancelled) {
          setLookupError("Could not load visa info. Tap to retry.");
          setLookup(null);
          setSelectedVisaType("");
        }
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [lookupReloadSeed, passportCountry, selectedTrip]);

  useEffect(() => {
    if (!selectedTrip || activeTab !== "alerts") return;
    const run = async () => {
      setAlertsLoading(true);
      setAlertsError("");
      try {
        const response = await fetch("/app/tools/visa3/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            destinationCountry: selectedTrip.destinationCountry,
            passportCountry,
          }),
        });
        if (!response.ok) throw new Error("Alerts request failed");
        setAlertsData((await response.json()) as VisaAlertsResponse);
      } catch {
        setAlertsError("Could not load alerts. Tap refresh.");
      } finally {
        setAlertsLoading(false);
      }
    };
    void run();
  }, [activeTab, passportCountry, selectedTrip]);

  if (!selectedTrip) {
    return <p className="px-4 pt-8 text-sm text-slate-600">Create a trip first to use Visa.</p>;
  }

  const returnDate = new Date(`${selectedTrip.endDate}T12:00:00`);
  const expiryDate = passportExpiryDate ? new Date(`${passportExpiryDate}T12:00:00`) : null;
  const expiryDiffDays =
    expiryDate && !Number.isNaN(expiryDate.getTime()) && !Number.isNaN(returnDate.getTime())
      ? Math.floor((expiryDate.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

  const applyBy = selectedOption ? applyByDate(selectedTrip.startDate, selectedOption.processingDays) : null;
  const daysLeft = applyBy ? Math.ceil((applyBy.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const checklistReadyCount = (selectedOption?.documents ?? []).filter((item) => {
    const key = item.name;
    return checkedItems[key] || !!uploadedDocs[key];
  }).length;

  const saveChecklist = (next: Record<string, boolean>) => {
    setCheckedItems(next);
    localStorage.setItem(checklistKey, JSON.stringify(next));
  };
  const saveUploads = (next: UploadState) => {
    setUploadedDocs(next);
    localStorage.setItem(uploadsKey, JSON.stringify(next));
  };

  const onUploadDoc = async (doc: VisaDocumentDetail, file: File) => {
    setUploadBusyByDoc((prev) => ({ ...prev, [doc.name]: true }));
    try {
      const form = new FormData();
      form.append("tripId", tripId);
      form.append("documentName", doc.name);
      form.append("file", file);
      const response = await fetch("/app/tools/visa3/api/upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Upload failed");
      const data = (await response.json()) as { storagePath: string };
      saveUploads({ ...uploadedDocs, [doc.name]: { storagePath: data.storagePath, fileName: file.name } });
      saveChecklist({ ...checkedItems, [doc.name]: true });
    } finally {
      setUploadBusyByDoc((prev) => ({ ...prev, [doc.name]: false }));
    }
  };

  const onDownloadZip = async () => {
    if (!selectedOption) return;
    setDownloadBusy(true);
    try {
      const zip = new JSZip();
      for (const doc of selectedOption.documents) {
        const uploaded = uploadedDocs[doc.name];
        if (!uploaded?.storagePath) continue;
        const signedRes = await fetch("/app/tools/visa3/api/download-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath: uploaded.storagePath }),
        });
        if (!signedRes.ok) continue;
        const { signedUrl } = (await signedRes.json()) as { signedUrl: string };
        const fileRes = await fetch(signedUrl);
        if (!fileRes.ok) continue;
        const blob = await fileRes.blob();
        zip.file(uploaded.fileName || `${doc.name}.pdf`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `visa-docs-${tripId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadBusy(false);
    }
  };

  const tabButton = (key: TabKey, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      className={`min-h-11 shrink-0 rounded-xl px-3 py-2 text-[13px] font-semibold ${
        activeTab === key ? "bg-slate-900 text-white" : "bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+5rem)]">
      <div className="mx-auto w-full max-w-[430px] space-y-3.5 px-4 pb-8 pt-3 md:max-w-2xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Trip</label>
              <select value={tripId} onChange={(e) => setTripId(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm">
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {compactTripOptionLabel(trip)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Passport country</label>
                <input list="visa3-country-list" value={passportCountry} onChange={(e) => setPassportCountry(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                <datalist id="visa3-country-list">{COUNTRY_OPTIONS.map((country) => <option key={country.code} value={country.name} />)}</datalist>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Passport expiry</label>
                <input type="date" value={passportExpiryDate} onChange={(e) => setPassportExpiryDate(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </div>
            </div>
          </div>

          <div className="mt-3">
            {expiryDiffDays == null ? (
              <p className="text-xs text-slate-500">Add passport expiry date for automatic validity checks.</p>
            ) : expiryDiffDays < 180 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-semibold text-rose-800">
                  Your passport expires {expiryDiffDays} days after your return. Most countries require 6 months validity. You may be denied boarding.
                </p>
                <a href="https://www.passportindia.gov.in/" target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-rose-700 px-3 text-xs font-semibold text-white">
                  Check passport renewal process
                </a>
              </div>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                <span aria-hidden>✅</span> Passport valid for this trip
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm" aria-busy={lookupLoading}>
          {lookupLoading ? (
            <SectionLoading label="Loading visa options…" />
          ) : lookupError || !lookup ? (
            <button type="button" onClick={() => setLookupReloadSeed((v) => v + 1)} className="flex min-h-16 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-700">
              {lookupError || "Could not load visa info. Tap to retry."}
            </button>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Select visa type</p>
              <div className="mt-2 space-y-2">
                {lookup.visaOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedVisaType(option.id)}
                    className={`w-full rounded-xl border p-3 text-left ${selectedVisaType === option.id ? visaTypeTone(option.id) : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs">{option.description}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {selectedOption ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${visaTypeTone(selectedOption.id)}`}>{selectedOption.label}</span>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Processing</p><p className="font-semibold text-slate-900">{selectedOption.processingTime}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Fee</p><p className="font-semibold text-slate-900">{selectedOption.feeInr}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Validity</p><p className="font-semibold text-slate-900">{selectedOption.validity}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] text-slate-500">Max stay</p><p className="font-semibold text-slate-900">{selectedOption.maxStay}</p></div>
              </div>
              <p className="mt-2 text-xs text-slate-600">{selectedOption.label} fee: {selectedOption.feeInr} - {selectedOption.feeNote}</p>
              <p className="mt-1 text-xs text-slate-500">Fees may change - verify on the official site before paying.</p>
              <a href={selectedOption.applyLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                Open official apply link
              </a>
            </section>

            <section className={`rounded-2xl border p-3.5 shadow-sm ${daysLeft == null ? "border-slate-200 bg-white text-slate-700" : countdownTone(daysLeft)}`}>
              <p className="text-sm font-semibold">
                {daysLeft == null
                  ? "Set trip dates to view deadline urgency"
                  : `${daysLeft} days left to apply (apply by ${applyBy ? formatSignedDate(applyBy) : "-"})`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[30, 15, 7].map((offset) => (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => {
                      setReminderOffset(offset as ReminderOffset);
                      localStorage.setItem(reminderKey, String(offset));
                    }}
                    className={`min-h-10 rounded-lg border px-3 text-xs font-semibold ${reminderOffset === offset ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                  >
                    Remind {offset} days before
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <section className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2 pb-1">
            {tabButton("guide", "Application Guide")}
            {tabButton("documents", `Documents${selectedOption ? ` (${checklistReadyCount}/${selectedOption.documents.length})` : ""}`)}
            {tabButton("alerts", "Entry Alerts")}
          </div>
        </section>

        {activeTab === "guide" && selectedOption ? (
          <section className="space-y-2.5">
            {selectedOption.guideSteps.map((step, index) => (
              <article key={step} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Step {index + 1}</p>
                <p className="mt-1 text-sm text-slate-800">{step}</p>
              </article>
            ))}
          </section>
        ) : null}

        {activeTab === "documents" && selectedOption ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{checklistReadyCount} / {selectedOption.documents.length} ready</p>
            <div className="mt-3 space-y-2">
              {selectedOption.documents.map((doc) => (
                <div key={doc.name} className="rounded-xl bg-slate-50 px-3 py-2">
                  <label className="flex min-h-11 items-start gap-2.5 text-[13px] text-slate-800 sm:text-sm">
                    <input
                      type="checkbox"
                      checked={!!checkedItems[doc.name] || !!uploadedDocs[doc.name]}
                      onChange={() => saveChecklist({ ...checkedItems, [doc.name]: !checkedItems[doc.name] })}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span className="flex-1 break-words">{doc.name}</span>
                    {!!uploadedDocs[doc.name] ? <span className="text-xs font-semibold text-emerald-700">Ready</span> : null}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" onClick={() => setExpandedDocs((prev) => ({ ...prev, [doc.name]: !prev[doc.name] }))} className="text-xs font-semibold text-indigo-700">
                      {expandedDocs[doc.name] ? "Hide details" : "Show details"}
                    </button>
                    <label className="inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700">
                      {uploadBusyByDoc[doc.name] ? "Uploading..." : "Upload / Take photo"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void onUploadDoc(doc, file);
                        }}
                      />
                    </label>
                  </div>
                  {expandedDocs[doc.name] ? (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                      <p><span className="font-semibold">Format:</span> {doc.format}</p>
                      <p className="mt-1"><span className="font-semibold">Requirement:</span> {doc.requirement}</p>
                      <p className="mt-1"><span className="font-semibold">Tip:</span> {doc.tip}</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => void onDownloadZip()} disabled={downloadBusy} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
              {downloadBusy ? "Preparing zip..." : "Download all docs as zip"}
            </button>
          </section>
        ) : null}

        {activeTab === "alerts" ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Entry alerts</p>
                <button type="button" onClick={() => setActiveTab("alerts")} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700">Refresh</button>
              </div>
              {alertsLoading ? (
                <SectionLoading label="Loading entry alerts…" />
              ) : alertsError ? (
                <p className="mt-3 text-sm text-rose-700">{alertsError}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {(alertsData?.alerts ?? []).map((alert) => (
                    <article key={`${alert.title}-${alert.detail}`} className={`rounded-xl border px-3 py-2 ${severityTone(alert.severity)}`}>
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs">{alert.detail}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <button type="button" onClick={() => setRejectionOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-left">
                <span className="text-sm font-semibold text-slate-900">What if my visa is rejected?</span>
                <span className="text-xs font-semibold text-slate-600">{rejectionOpen ? "Hide" : "Show"}</span>
              </button>
              {rejectionOpen && lookup ? (
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Top rejection reasons</p>
                  <ul className="space-y-1.5">
                    {lookup.rejectionGuide.reasons.map((reason) => (
                      <li key={reason} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">{reason}</li>
                    ))}
                  </ul>
                  <p><span className="font-semibold">What to do now:</span> {lookup.rejectionGuide.immediateAction}</p>
                  <p><span className="font-semibold">Reapplication timeline:</span> {lookup.rejectionGuide.timeline}</p>
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{lookup.rejectionGuide.reassurance}</p>
                </div>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
