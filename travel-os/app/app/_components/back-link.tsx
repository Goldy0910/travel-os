"use client";

import Link from "next/link";

type BackLinkProps = {
  href: string;
  children?: React.ReactNode;
  /** Use on dark hero sections */
  variant?: "default" | "onDark";
};

export default function BackLink({
  href,
  children = "Back",
  variant = "default",
}: BackLinkProps) {
  const classes =
    variant === "onDark"
      ? "inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
      : "inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900";

  return (
    <Link href={href} className={classes}>
      <span aria-hidden className="select-none">
        ←
      </span>
      {children}
    </Link>
  );
}
