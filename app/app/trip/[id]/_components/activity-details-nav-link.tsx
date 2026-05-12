"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
};

export default function ActivityDetailsNavLink({ href, className, children }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const overlay =
    isPending && mounted ? (
      <div
        className="fixed inset-0 z-[250] flex flex-col items-center justify-center gap-3 bg-black/30 backdrop-blur-[2px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <ButtonSpinner className="h-10 w-10 text-white drop-shadow" />
        <p className="text-sm font-semibold text-white drop-shadow-md">Opening activity…</p>
      </div>
    ) : null;

  return (
    <>
      {mounted && overlay ? createPortal(overlay, document.body) : null}
      <Link
        href={href}
        prefetch
        className={className}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          startTransition(() => {
            router.push(href);
          });
        }}
      >
        {children}
      </Link>
    </>
  );
}
