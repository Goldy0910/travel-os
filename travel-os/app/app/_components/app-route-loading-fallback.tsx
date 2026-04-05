/**
 * Instant full-width placeholder while a server component route segment loads (Next.js loading.js).
 */
export default function AppRouteLoadingFallback() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-full max-w-sm animate-pulse rounded bg-slate-200" />
        <div className="space-y-3 pt-2">
          <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-200/90" />
          <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-200/90" />
          <div className="h-28 w-full animate-pulse rounded-2xl bg-slate-200/90" />
        </div>
        <div className="flex flex-col items-center gap-3 pt-8">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-600">Loading…</p>
        </div>
      </div>
    </main>
  );
}
