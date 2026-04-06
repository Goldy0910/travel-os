import PageLoader from "@/components/ui/page-loader";

/**
 * Default route-segment loading UI (Next.js `loading.tsx`).
 * Full-width, centered in the scroll area — not attached to tabs or nav controls.
 */
export default function AppRouteLoadingFallback() {
  return (
    <main className="flex min-h-full w-full flex-1 flex-col bg-slate-50 pb-28">
      <PageLoader fillViewport message="Loading…" />
    </main>
  );
}
