import Link from "next/link";

export default function ShareNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-6 text-center">
      <h1 className="text-2xl font-bold text-white">This trip link is unavailable</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-400">
        It may have been revoked or the link is incorrect.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-500 px-6 text-sm font-semibold text-slate-950 touch-manipulation"
      >
        Go to TravelTill99
      </Link>
    </div>
  );
}
