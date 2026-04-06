"use client";

export type PageLoaderProps = {
  /** Shown under the spinner */
  message?: string;
  className?: string;
  /**
   * When true, expands to roughly the visible app content area (below the app header,
   * accounting for bottom nav safe area). Use in route `loading.tsx` fallbacks.
   */
  fillViewport?: boolean;
};

/**
 * Centered, minimal loading state for full-page or large content regions.
 * Uses a subtle fade-in (see `travel-os-page-loader-in` in `app/globals.css`).
 */
export default function PageLoader({
  message = "Loading…",
  className = "",
  fillViewport = false,
}: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={[
        "flex w-full flex-col items-center justify-center gap-3 px-4 py-12",
        "animate-[travel-os-page-loader-in_0.35s_ease-out_both]",
        fillViewport
          ? "min-h-[calc(100dvh-3.5rem-var(--travel-os-bottom-nav-h))]"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700"
        aria-hidden
      />
      <p className="text-center text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
