import PageLoader from "@/components/ui/page-loader";

/**
 * Shown during client navigation while the Activity Details server page resolves.
 */
export default function ActivityDetailsLoading() {
  return (
    <main className="flex min-h-full w-full flex-1 flex-col bg-slate-50 pb-[calc(var(--travel-os-bottom-nav-h)+3rem)]">
      <PageLoader fillViewport message="Loading activity…" />
    </main>
  );
}
