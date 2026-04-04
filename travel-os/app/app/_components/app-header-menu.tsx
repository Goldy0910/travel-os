"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

function IconDotsVertical({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

type Props = {
  /** e.g. absolute right-0 top-0 when header is centered */
  className?: string;
  /** Light header background (dashboard) vs dark-on-gradient trip card */
  variant?: "light" | "dark";
};

export default function AppHeaderMenu({ className = "", variant = "light" }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open]);

  const triggerClass =
    variant === "light"
      ? "text-slate-700 hover:bg-slate-200/80 active:bg-slate-200"
      : "text-white/90 hover:bg-white/10 active:bg-white/15";

  return (
    <div className={`relative shrink-0 ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 min-w-11 items-center justify-center rounded-full transition ${triggerClass}`}
      >
        <span className="sr-only">Menu</span>
        <IconDotsVertical className="h-6 w-6" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Link
            href="/app/settings"
            role="menuitem"
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
