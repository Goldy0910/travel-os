"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

type Props = {
  /** Full join URL including ?code= when available */
  joinUrl: string;
  whatsappHref: string;
  hasInviteCode: boolean;
  inviteCode?: string;
};

export default function InviteShareBlock({
  joinUrl,
  whatsappHref,
  hasInviteCode,
  inviteCode,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const copyLink = useCallback(async () => {
    setError("");
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      toast.success("Invite link copied.");
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const msg = "Could not copy. Select the link below and copy manually.";
      setError(msg);
      toast.error(msg);
    }
  }, [joinUrl]);

  return (
    <div className="space-y-5">
      {!hasInviteCode ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This trip does not have an invite code yet. Ask an organizer to refresh trip settings or
          run the latest database migration so links work for new guests.
        </p>
      ) : null}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Invite link
        </p>
        <div className="mt-2 min-h-[3.25rem] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 break-all">
          {joinUrl}
        </div>
        {inviteCode ? (
          <p className="mt-2 text-xs text-slate-500">
            Code: <span className="font-mono font-medium text-slate-800">{inviteCode}</span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={copyLink}
          className="flex min-h-14 w-full touch-manipulation items-center justify-center rounded-2xl border-2 border-slate-900 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm transition active:scale-[0.99] active:bg-slate-50"
        >
          {copied ? "Copied to clipboard" : "Copy invite link"}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-14 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-base font-semibold text-white shadow-md shadow-emerald-900/15 transition active:scale-[0.99] active:bg-[#20BD5A]"
        >
          <WhatsAppGlyph className="h-6 w-6 shrink-0" aria-hidden />
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.881 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
