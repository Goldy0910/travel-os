import type { ReactNode } from "react";

export default function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-[min(100%,18.5rem)] ${className}`}
    >
      <div className="rounded-[2.15rem] border-[9px] border-[#0f172a] bg-[#0f172a] p-[3px] shadow-[0_28px_60px_-18px_rgba(15,23,42,0.55)]">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-white">
          <div
            className="pointer-events-none absolute left-1/2 top-2 z-20 h-[18px] w-[92px] -translate-x-1/2 rounded-full bg-[#0f172a]"
            aria-hidden
          />
          {children}
        </div>
      </div>
    </div>
  );
}
