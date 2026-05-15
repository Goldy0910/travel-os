function Block({ className }: { className: string }) {
  return <div className={`animate-pulse ${className}`} aria-hidden />;
}

export default function ResultSkeleton() {
  return (
    <div
      className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50"
      aria-busy="true"
      aria-label="Loading recommendation"
    >
      <Block className="h-6 w-2/3 rounded-lg bg-slate-200" />
      <Block className="h-4 w-full rounded-lg bg-slate-100" />
      <Block className="h-4 w-5/6 rounded-lg bg-slate-100" />
      <div className="grid gap-2 sm:grid-cols-2">
        <Block className="h-16 rounded-2xl bg-slate-100" />
        <Block className="h-16 rounded-2xl bg-slate-100" />
      </div>
      <Block className="h-24 rounded-2xl bg-slate-50" />
      <div className="flex gap-2">
        <Block className="h-11 flex-1 rounded-xl bg-slate-200" />
        <Block className="h-11 flex-1 rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
