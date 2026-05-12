"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useState } from "react";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import type { FormActionResult } from "@/lib/form-action-result";

type Props = {
  tripId: string;
  onGenerateAi: (formData: FormData) => Promise<FormActionResult>;
  onImportPdf: (formData: FormData) => Promise<FormActionResult>;
  onChooseManual: () => void;
  /** Optional; server actions already revalidate — used for extra client cleanup if needed. */
  onCreated?: () => void;
};

type SetupMode = "none" | "ai" | "pdf";
type PdfPreviewRow = {
  date: string;
  title: string;
  location: string;
  time: string | null;
  notes: string | null;
};

export default function ItineraryCreationSetup({
  tripId,
  onGenerateAi,
  onImportPdf,
  onChooseManual,
  onCreated,
}: Props) {
  const [mode, setMode] = useState<SetupMode>("none");
  const [inlineError, setInlineError] = useState("");
  const [previewRows, setPreviewRows] = useState<PdfPreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const { pending, handleForm } = useFormActionFeedback();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        How would you like to create your itinerary?
      </h2>

      {inlineError ? (
        <button
          type="button"
          onClick={() => {
            setInlineError("");
            if (mode === "none") setMode("ai");
          }}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-700"
        >
          {inlineError}
        </button>
      ) : null}

      <div className="mt-3 space-y-2.5">
        <button
          type="button"
          onClick={() => {
            setInlineError("");
            setMode("ai");
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left"
        >
          <p className="text-sm font-semibold text-slate-900">Generate by AI</p>
          <p className="mt-1 text-xs text-slate-600">
            ✨ We&apos;ll create a draft itinerary. You can edit everything later.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setInlineError("");
            setMode("pdf");
            setPreviewRows([]);
            setPreviewError("");
          }}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left"
        >
          <p className="text-sm font-semibold text-slate-900">Upload a PDF</p>
          <p className="mt-1 text-xs text-slate-600">
            📄 We&apos;ll extract your plan exactly as-is. Missing details won&apos;t be filled automatically.
          </p>
        </button>

        <button
          type="button"
          onClick={onChooseManual}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left"
        >
          <p className="text-sm font-semibold text-slate-900">Add manually</p>
          <p className="mt-1 text-xs text-slate-600">
            Continue with the existing add-activity flow.
          </p>
        </button>
      </div>

      <BottomSheetModal
        open={mode === "ai"}
        onClose={() => setMode("none")}
        title="AI itinerary draft"
        description="Add optional context before generating your itinerary."
        panelClassName="max-h-[80vh]"
      >
        <form
          className="space-y-2.5 pb-2"
          onSubmit={(e) =>
            handleForm(
              e,
              async (fd) => {
                fd.set("tripId", tripId);
                const result = await onGenerateAi(fd);
                if (!result.ok) {
                  setInlineError(result.error || "AI generation failed. Please retry.");
                }
                else {
                  localStorage.setItem(
                    `travel-os-itinerary-draft-cache:${tripId}`,
                    JSON.stringify({ source: "ai", createdAt: new Date().toISOString() }),
                  );
                  setInlineError("");
                }
                return result;
              },
              () => {
                setMode("none");
                onCreated?.();
              },
            )
          }
        >
          <input
            type="text"
            name="interests"
            placeholder="Interests (optional)"
            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <input
            type="text"
            name="budget"
            placeholder="Budget (optional)"
            className="min-h-11 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("none")}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? (
                <>
                  <ButtonSpinner className="h-4 w-4 text-white" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </button>
          </div>
        </form>
      </BottomSheetModal>

      <BottomSheetModal
        open={mode === "pdf"}
        onClose={() => setMode("none")}
        title="Import from PDF"
        description="Upload your itinerary PDF and preview extracted activities."
        panelClassName="max-h-[85vh]"
      >
        <form
          className="space-y-2.5 pb-2"
          onSubmit={(e) =>
            handleForm(
              e,
              async (fd) => {
                fd.set("tripId", tripId);
                const result = await onImportPdf(fd);
                if (!result.ok) {
                  setInlineError("Couldn't extract itinerary clearly. Please review or add manually.");
                } else {
                  localStorage.setItem(
                    `travel-os-itinerary-draft-cache:${tripId}`,
                    JSON.stringify({ source: "pdf", createdAt: new Date().toISOString() }),
                  );
                  setInlineError("");
                }
                return result;
              },
              () => {
                setMode("none");
                onCreated?.();
              },
            )
          }
        >
          <input
            id={`itinerary-pdf-upload-${tripId}`}
            type="file"
            name="itineraryPdf"
            accept="application/pdf"
            required
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              const input = document.getElementById(
                `itinerary-pdf-upload-${tripId}`,
              ) as HTMLInputElement | null;
              const file = input?.files?.[0];
              if (!file) {
                setPreviewError("Please choose a PDF first.");
                return;
              }
              setPreviewLoading(true);
              setPreviewError("");
              setPreviewRows([]);
              try {
                const fd = new FormData();
                fd.set("itineraryPdf", file);
                const response = await fetch(
                  `/app/trip/${encodeURIComponent(tripId)}/api/itinerary-pdf-preview`,
                  { method: "POST", body: fd },
                );
                const data = (await response.json()) as {
                  ok?: boolean;
                  error?: string;
                  activities?: PdfPreviewRow[];
                };
                if (!response.ok || !data.ok) {
                  setPreviewError(
                    data.error || "Couldn't extract itinerary clearly. Please review or add manually.",
                  );
                  return;
                }
                setPreviewRows(Array.isArray(data.activities) ? data.activities : []);
                if (!data.activities || data.activities.length === 0) {
                  setPreviewError("No clear itinerary rows found in this PDF.");
                }
              } catch {
                setPreviewError("Couldn't extract itinerary clearly. Please review or add manually.");
              } finally {
                setPreviewLoading(false);
              }
            }}
            disabled={previewLoading || pending}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {previewLoading ? "Previewing..." : "Preview extracted itinerary"}
          </button>

          {previewError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
              {previewError}
            </div>
          ) : null}

          {previewRows.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-2.5">
              <p className="text-xs font-semibold text-slate-700">
                Preview ({previewRows.length} extracted activities)
              </p>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                {previewRows.map((row, idx) => (
                  <div key={`${row.date}-${row.title}-${idx}`} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-xs font-semibold text-slate-800">{row.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {row.date} {row.time ? `• ${row.time}` : ""}
                    </p>
                    {row.location ? <p className="text-[11px] text-slate-500">{row.location}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("none")}
              className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || previewRows.length === 0}
              className="min-h-11 flex-1 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Extracting..." : "Extract"}
            </button>
          </div>
        </form>
      </BottomSheetModal>

    </section>
  );
}
