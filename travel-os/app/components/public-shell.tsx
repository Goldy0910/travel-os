import type { ReactNode } from "react";

type PublicShellProps = {
  children: ReactNode;
  /** Optional sticky footer region (e.g. mobile CTA) */
  footer?: ReactNode;
};

/**
 * Responsive public chrome: full-bleed mobile browser UI by default;
 * wider web-app frame from `md` up (no phone-device chrome on desktop).
 */
export default function PublicShell({ children, footer }: PublicShellProps) {
  return (
    <div className="min-h-dvh bg-white md:bg-slate-100">
      <div className="travel-os-public-frame flex min-h-dvh w-full flex-col bg-white md:min-h-screen md:shadow-sm md:ring-1 md:ring-slate-200/80">
        {children}
      </div>
      {footer}
    </div>
  );
}
