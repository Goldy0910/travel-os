"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { createTripShareAction } from "@/app/app/master-trip/share-actions";
import TripShareCard from "@/app/components/share/trip-share-card";
import { buildPublicTripShareSnapshot } from "@/lib/trip-share/sanitize";
import { buildShareMessage, buildWhatsAppShareUrl } from "@/lib/trip-share/urls";
import type { MasterTripFile } from "@/lib/master-trip-file";
import { Copy, MessageCircle, Share2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  masterId: string;
  file: MasterTripFile;
  open: boolean;
  onClose: () => void;
};

export default function ShareTripSheet({ masterId, file, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const previewSnapshot = useMemo(
    () => buildPublicTripShareSnapshot(file, { sharedAt: new Date().toISOString() }),
    [file],
  );

  const ensureShareLink = useCallback(async (): Promise<string | null> => {
    if (shareUrl) return shareUrl;
    setLoading(true);
    try {
      const res = await createTripShareAction(masterId);
      if (res.ok) {
        setShareUrl(res.shareUrl);
        return res.shareUrl;
      }
      toast.error(res.error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [masterId, shareUrl]);

  useEffect(() => {
    if (!open) return;
    void ensureShareLink();
  }, [open, ensureShareLink]);

  const handleCopy = async () => {
    const url = await ensureShareLink();
    if (!url) return;
    const text = `${buildShareMessage(previewSnapshot)}\n\n${url}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleWhatsApp = async () => {
    const url = await ensureShareLink();
    if (!url) return;
    const message = buildShareMessage(previewSnapshot);
    const wa = buildWhatsAppShareUrl(message, url);
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    const url = await ensureShareLink();
    if (!url) return;
    const title = `${previewSnapshot.destination.name} · TravelTill99`;
    const text = buildShareMessage(previewSnapshot);
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        toast.success("Copied to clipboard");
      }
    } catch {
      /* cancelled */
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        aria-label="Close share"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-trip-title"
        className="relative max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-md">
          <h2 id="share-trip-title" className="text-base font-semibold text-slate-900">
            Share trip
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 touch-manipulation"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-sm text-slate-500">
            Preview how your trip looks when shared. Links update when you share again.
          </p>

          <div className="pointer-events-none scale-[0.98] origin-top">
            <TripShareCard snapshot={previewSnapshot} variant="preview" />
          </div>

          {loading && !shareUrl ? (
            <p className="flex items-center justify-center gap-2 py-2 text-sm text-slate-500">
              <ButtonSpinner />
              Preparing link…
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleWhatsApp()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 text-sm font-semibold text-white touch-manipulation disabled:opacity-60"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleCopy()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 touch-manipulation disabled:opacity-60"
            >
              <Copy className="h-4 w-4" aria-hidden />
              Copy link
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleNativeShare()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white touch-manipulation disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
