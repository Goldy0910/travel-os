"use client";

import Link from "next/link";
import { useState } from "react";

type HubDocItemProps = {
  fileName: string;
  fileTypeLabel: string;
  fileUrl: string | null;
  tripLabel: string;
  uploadedBy: string;
  uploadedAt: string;
  href: string;
};

function fileGlyph(fileTypeLabel: string) {
  if (fileTypeLabel === "PDF") return "PDF";
  if (fileTypeLabel === "Image") return "IMG";
  return "FILE";
}

export default function HubDocItem({
  fileName,
  fileTypeLabel,
  fileUrl,
  tripLabel,
  uploadedBy,
  uploadedAt,
  href,
}: HubDocItemProps) {
  const canTryPreview = !!fileUrl && fileTypeLabel !== "PDF";
  const [imageBroken, setImageBroken] = useState(false);

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition active:bg-slate-50"
    >
      <span className="inline-flex h-12 min-w-12 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
        {canTryPreview && !imageBroken ? (
          <img
            src={fileUrl ?? ""}
            alt={fileName}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <span className="px-2">{fileGlyph(fileTypeLabel)}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{fileName}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            {tripLabel}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-slate-500">{fileTypeLabel}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {uploadedBy} · {uploadedAt}
        </p>
      </div>
    </Link>
  );
}
