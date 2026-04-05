"use client";

import type { DocumentKind } from "../_lib/file-kind";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type DocumentViewerModalProps = {
  open: boolean;
  onClose: () => void;
  url: string;
  fileName: string;
  kind: DocumentKind;
};

export default function DocumentViewerModal({
  open,
  onClose,
  url,
  fileName,
  kind,
}: DocumentViewerModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={fileName}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-black/90 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{fileName}</p>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-lg text-white transition hover:bg-white/10"
          aria-label="Close preview"
        >
          ×
        </button>
      </header>
      {kind === "pdf" ? (
        <div className="shrink-0 border-b border-white/10 bg-black/80 px-4 py-2 text-center">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            Open PDF in new tab
          </a>
          <span className="mx-2 text-white/30">·</span>
          <span className="text-xs text-white/50">If the preview is blank, use the link above</span>
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden bg-black">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Supabase public URL, dynamic per document
          <img
            src={url}
            alt={fileName}
            className="mx-auto h-full max-h-full w-full object-contain"
          />
        ) : kind === "pdf" ? (
          <iframe
            src={url}
            title={fileName}
            className="h-full w-full border-0 bg-neutral-900"
            allow="fullscreen"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="rounded-2xl bg-white/5 p-6 text-white/90">
              <FileGlyph className="mx-auto h-14 w-14 text-white/60" />
              <p className="mt-4 text-sm leading-relaxed">
                Preview isn&apos;t available for this file type. Open it in your browser instead.
              </p>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-900 shadow-lg"
            >
              Open file
            </a>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function FileGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  );
}
