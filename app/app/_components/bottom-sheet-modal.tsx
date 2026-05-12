"use client";

import { useLockScroll } from "@/app/app/_hooks/use-lock-scroll";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type BottomSheetModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  titleId?: string;
  children: React.ReactNode;
  /** Panel sizing (Tailwind classes). Default ~70vh max height. */
  panelClassName?: string;
  /** Root z-index class */
  zClass?: string;
  /** If false, omit drag handle */
  showHandle?: boolean;
};

export default function BottomSheetModal({
  open,
  onClose,
  title,
  description,
  titleId = "bottom-sheet-title",
  children,
  panelClassName = "max-h-[70vh]",
  zClass = "z-[200]",
  showHandle = true,
}: BottomSheetModalProps) {
  const [mounted, setMounted] = useState(false);
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useLockScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const resetScroll = () => {
      if (scrollBodyRef.current) {
        scrollBodyRef.current.scrollTop = 0;
      }
    };
    resetScroll();
    const raf = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  if (!mounted) return null;

  const overlay = (
    <div
      className={`fixed inset-0 flex flex-col justify-end overflow-x-hidden overflow-y-hidden overscroll-none sm:px-4 ${zClass} ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Close dialog"
        className={`absolute inset-0 z-0 touch-none bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div className="relative z-10 mx-auto w-full max-w-md overflow-x-hidden [touch-action:pan-y]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          onClick={(e) => e.stopPropagation()}
          className={`flex min-h-0 w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)] transition-transform duration-300 ease-out will-change-transform ${panelClassName} ${
            open
              ? "translate-y-0"
              : "translate-y-[calc(100%+var(--travel-os-bottom-nav-h,4rem))]"
          }`}
        >
          {showHandle ? (
            <div className="flex shrink-0 justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            </div>
          ) : null}
          {title || description ? (
            <div className="shrink-0 px-5 pt-1 pb-2">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                  {title}
                </h2>
              ) : null}
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>
          ) : null}
          <div
            ref={scrollBodyRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] [touch-action:pan-y]"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
