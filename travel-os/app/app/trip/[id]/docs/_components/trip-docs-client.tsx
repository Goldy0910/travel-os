"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import ButtonSpinner from "@/app/app/_components/button-spinner";
import { useFormActionFeedback } from "@/app/app/_components/use-form-action-feedback";
import { showNoInternetModal } from "@/app/app/_components/no-internet-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useTripActiveTab } from "../../_lib/trip-active-tab-context";
import { useTripFabRegistry } from "../../_lib/trip-tab-fab-registry";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RefObject } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { deleteDocumentAction } from "../../data-actions";
import { saveDocumentRecord, updateDocumentFileName } from "../actions";
import type { DocumentKind } from "../_lib/file-kind";
import { detectDocumentKind } from "../_lib/file-kind";
import DocumentViewerModal from "./document-viewer-modal";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_DOCS_BUCKET || "trip-docs";
const QUICK_ACTION_EVENT = "travel-os-open-quick-action";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_FILE_TYPES = /\.(pdf|jpe?g|png|gif|webp|heic|bmp|svg|txt|csv|doc|docx|xls|xlsx|ppt|pptx)$/i;

export type DocumentDTO = {
  id: string;
  file_name: string | null;
  file_url: string | null;
  created_at: string | null;
};

type TripDocsClientProps = {
  tripId: string;
  documents: DocumentDTO[];
  initialSuccess: string;
  initialError: string;
  autoOpenUpload?: boolean;
};

function formatUploadedAt(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

function isAllowedFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  if (file.type === "application/pdf") return true;
  if (
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    file.type.includes("wordprocessingml") ||
    file.type.includes("spreadsheetml") ||
    file.type.includes("presentationml")
  ) {
    return true;
  }
  const lower = file.name.toLowerCase();
  return ALLOWED_FILE_TYPES.test(lower);
}

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function useDismissOnOutsideClick(
  open: boolean,
  onClose: () => void,
  excludeRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (excludeRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, onClose, excludeRef]);
}

function IconDotsVertical({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function PdfGlyph({ className = "h-9 w-9 text-rose-600" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path d="M13 3v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 14h6M9 18h4" strokeLinecap="round" />
    </svg>
  );
}

function GenericFileGlyph({ className = "h-9 w-9 text-slate-400" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  );
}

function DocumentThumb({
  url,
  kind,
}: {
  url: string;
  kind: DocumentKind;
}) {
  if (kind === "image" && url) {
    return (
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase URL */}
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }
  if (kind === "pdf") {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-rose-50 ring-1 ring-rose-100">
        <PdfGlyph />
      </div>
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
      <GenericFileGlyph />
    </div>
  );
}

function DocumentRowMenu({
  tripId,
  doc,
  onView,
  onRename,
  onOpenChange,
}: {
  tripId: string;
  doc: DocumentDTO;
  onView: () => void;
  onRename: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { pending: deletePending, runAction: runDeleteDoc } = useFormActionFeedback();

  const setMenuOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useDismissOnOutsideClick(open, () => setMenuOpen(false), wrapRef);

  return (
    <div className="relative shrink-0 self-start" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setMenuOpen(!open)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        <span className="sr-only">Document options</span>
        <IconDotsVertical />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-1 top-full z-[130] mt-1 w-44 origin-top-right rounded-xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
        >
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              // Defer so the menu unmount doesn’t “swallow” the click / leave a ghost click on the row below.
              window.setTimeout(() => onView(), 0);
            }}
          >
            View
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(false);
              window.setTimeout(() => onRename(), 0);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={deletePending}
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            onClick={() => {
              if (
                !window.confirm(
                  "Delete this document? It will be removed from storage and cannot be undone.",
                )
              ) {
                return;
              }
              setMenuOpen(false);
              runDeleteDoc(() => deleteDocumentAction(tripId, doc.id, new FormData()));
            }}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DocsUploadSheet({
  open,
  onClose,
  tripId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setError("");
      setDisplayName("");
      setPickedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [open]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showNoInternetModal();
      return;
    }
    const file = inputRef.current?.files?.[0];
    if (!file || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `File is too large (${formatMb(file.size)}). Maximum allowed size is 5.00 MB.`,
      );
      return;
    }
    if (!isAllowedFile(file)) {
      setError(
        "Unsupported file type. Allowed: PDF, JPG/JPEG, PNG, GIF, WEBP, HEIC, BMP, SVG, TXT, CSV, DOC/DOCX, XLS/XLSX, PPT/PPTX.",
      );
      return;
    }

    const finalName = (displayName.trim() || file.name).trim();
    if (!finalName) {
      setError("Add a file name.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          showNoInternetModal();
          setUploading(false);
          return;
        }
        setError("You must be signed in to upload.");
        setUploading(false);
        return;
      }

      const safeName = file.name.replace(/\s+/g, "-");
      const filePath = `${user.id}/${tripId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        const lowerMsg = (uploadError.message || "").toLowerCase();
        if (lowerMsg.includes("too large") || lowerMsg.includes("payload") || lowerMsg.includes("size")) {
          setError(
            `Upload failed because file is too large (${formatMb(file.size)}). Please use a file up to 5.00 MB.`,
          );
          setUploading(false);
          return;
        }
        setError(
          uploadError.message ||
            "Upload failed. Check that the Storage bucket exists and policies allow uploads.",
        );
        setUploading(false);
        return;
      }

      const saveResult = await saveDocumentRecord({
        tripId,
        filePath,
        fileName: finalName,
      });

      if (!saveResult.ok) {
        setError(saveResult.error);
        setUploading(false);
        toast.error(saveResult.error);
        return;
      }

      toast.success(saveResult.message);
      if (inputRef.current) inputRef.current.value = "";
      setDisplayName("");
      onClose();
      onUploaded();
    } catch (err) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        showNoInternetModal();
        setUploading(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      title="Upload document"
      description="Images and PDFs (tickets, confirmations, bookings)."
      panelClassName="max-h-[68vh]"
      titleId="docs-upload-sheet-title"
    >
      <form onSubmit={handleUpload} className="flex flex-col gap-4 pb-1">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}

        <div className="block">
          <span className="text-sm font-medium text-slate-700">File</span>
          <div className="mt-2">
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.bmp,.svg,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,application/pdf,image/*,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                className="sr-only"
                disabled={uploading}
                onChange={() => {
                  const file = inputRef.current?.files?.[0] ?? null;
                  setPickedFile(file);
                  if (file) {
                    setDisplayName((prev) => (prev.trim() ? prev : file.name));
                  }
                }}
              />
              <span className="line-clamp-2 break-all">
                {pickedFile?.name ?? "Tap to choose image or PDF"}
              </span>
            </label>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Max file size: 5 MB. Common formats supported (PDF, images, Office docs, text/csv).
        </p>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(ev) => setDisplayName(ev.target.value)}
            placeholder="Auto-filled from file"
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            disabled={uploading}
          />
        </label>

        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-800 shadow-sm active:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-base font-medium text-white shadow-md shadow-slate-900/20 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <ButtonSpinner className="h-4 w-4 text-white" />
                Uploading…
              </>
            ) : (
              "Upload"
            )}
          </button>
        </div>
      </form>
    </BottomSheetModal>
  );
}

function RenameDocumentSheet({
  open,
  onClose,
  tripId,
  doc,
  onRenamed,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
  doc: DocumentDTO | null;
  onRenamed: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (doc && open) {
      setName(doc.file_name || "");
      setError("");
    }
  }, [doc, open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc) return;
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    try {
      const res = await updateDocumentFileName({
        tripId,
        documentId: doc.id,
        fileName: trimmed,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        setPending(false);
        return;
      }
      toast.success(res.message);
      onClose();
      onRenamed();
    } catch {
      setError("Could not rename.");
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheetModal
      open={open && !!doc}
      onClose={onClose}
      title="Rename"
      description="Update how this file appears in your list."
      panelClassName="max-h-[50vh]"
      titleId="docs-rename-sheet-title"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">File name</span>
          <input
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
            disabled={pending}
          />
        </label>
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white py-3 text-base font-medium text-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-base font-medium text-white disabled:opacity-60"
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
    </BottomSheetModal>
  );
}

export default function TripDocsClient({
  tripId,
  documents,
  initialSuccess,
  initialError,
  autoOpenUpload = false,
}: TripDocsClientProps) {
  const router = useRouter();
  const activeTripTab = useTripActiveTab();
  const { setOpenUpload } = useTripFabRegistry();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docMenuOpenId, setDocMenuOpenId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    url: string;
    fileName: string;
    kind: DocumentKind;
  } | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocumentDTO | null>(null);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const openUploadSheet = useCallback(() => {
    setUploadOpen(true);
  }, []);

  useEffect(() => {
    setOpenUpload(openUploadSheet);
    return () => setOpenUpload(null);
  }, [setOpenUpload, openUploadSheet]);

  useEffect(() => {
    if (activeTripTab !== "docs" || !autoOpenUpload) return;
    setUploadOpen(true);
  }, [activeTripTab, autoOpenUpload]);

  useEffect(() => {
    const onQuickAction = (event: Event) => {
      if (activeTripTab !== "docs") return;
      const detail = (event as CustomEvent<{ action?: string }>).detail;
      if (detail?.action === "doc") setUploadOpen(true);
    };
    window.addEventListener(QUICK_ACTION_EVENT, onQuickAction as EventListener);
    return () => window.removeEventListener(QUICK_ACTION_EVENT, onQuickAction as EventListener);
  }, [activeTripTab]);

  useEffect(() => {
    if (activeTripTab !== "docs") {
      setUploadOpen(false);
    }
  }, [activeTripTab]);

  const openViewer = (doc: DocumentDTO) => {
    const url = doc.file_url ?? "";
    if (!url) return;
    const kind = detectDocumentKind(doc.file_name, doc.file_url);
    if (kind === "other") {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setViewer({
      url,
      fileName: doc.file_name || "Document",
      kind,
    });
  };

  return (
    <>
      <header className="space-y-1 pb-2">
        <p className="text-sm text-slate-600">
          Tickets, PDFs, and travel paperwork for this trip.
        </p>
      </header>

      {initialSuccess ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{initialSuccess}</p>
      ) : null}
      {initialError ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{initialError}</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your files</h2>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="rounded-2xl bg-slate-100 p-5 text-slate-400">
              <GenericFileGlyph className="mx-auto h-12 w-12 text-slate-400" />
            </div>
            <p className="mt-5 text-base font-semibold text-slate-900">No documents uploaded yet</p>
            <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-slate-600">
              Upload your tickets and bookings here
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {documents.map((doc) => {
              const name = doc.file_name || "Untitled file";
              const kind = detectDocumentKind(doc.file_name, doc.file_url);
              const dateLabel = formatUploadedAt(doc.created_at);

              return (
                <li
                  key={doc.id}
                  className={
                    docMenuOpenId === doc.id ? "relative z-[125]" : "relative z-0"
                  }
                >
                  <div className="relative flex rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => openViewer(doc)}
                      className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3 p-4 text-left transition active:bg-slate-50/80"
                    >
                      <DocumentThumb url={doc.file_url ?? ""} kind={doc.file_url ? kind : "other"} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-slate-900">{name}</p>
                        {dateLabel ? (
                          <p className="mt-1 text-xs text-slate-500">Uploaded {dateLabel}</p>
                        ) : null}
                      </div>
                    </button>
                    <DocumentRowMenu
                      tripId={tripId}
                      doc={doc}
                      onView={() => openViewer(doc)}
                      onRename={() => setRenameDoc(doc)}
                      onOpenChange={(open) =>
                        setDocMenuOpenId(open ? doc.id : null)
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <DocsUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        tripId={tripId}
        onUploaded={refresh}
      />

      <RenameDocumentSheet
        open={!!renameDoc}
        onClose={() => setRenameDoc(null)}
        tripId={tripId}
        doc={renameDoc}
        onRenamed={refresh}
      />

      <DocumentViewerModal
        open={!!viewer}
        onClose={() => setViewer(null)}
        url={viewer?.url ?? ""}
        fileName={viewer?.fileName ?? ""}
        kind={viewer?.kind ?? "other"}
      />
    </>
  );
}
