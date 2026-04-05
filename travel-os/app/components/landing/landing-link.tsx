"use client";

import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import Link from "next/link";
import type { ReactNode } from "react";

export default function LandingLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      <span className="inline-flex items-center justify-center gap-2 text-inherit">
        {children}
        <LinkLoadingIndicator spinnerClassName="h-4 w-4 text-current" />
      </span>
    </Link>
  );
}
