export default function TripTabsFallback() {
  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-col self-center">
      <div
        className="scrollbar-hide sticky top-0 z-[115] -mx-4 flex gap-2 overflow-hidden border-b border-slate-200/90 bg-white/95 px-3 pb-0 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-white/90"
        aria-hidden
      >
        {["Itinerary", "Expenses", "Connect", "Explore", "Checklist", "Food", "Language"].map((label) => (
          <div
            key={label}
            className="h-11 min-w-[5.5rem] shrink-0 rounded-t-lg bg-slate-100/90 px-3 py-3"
          >
            <div className="h-4 w-14 travel-os-shimmer rounded" />
          </div>
        ))}
      </div>
      <div className="px-4 py-6">
        <div className="mx-auto h-40 max-w-sm travel-os-shimmer rounded-2xl" />
        <div className="mx-auto mt-4 h-24 max-w-sm travel-os-shimmer rounded-xl" />
      </div>
    </div>
  );
}
