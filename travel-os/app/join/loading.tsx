export default function JoinLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"
          aria-hidden
        />
        <p className="text-sm font-medium text-slate-700">Joining trip…</p>
      </div>
    </main>
  );
}
