import Link from "next/link";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";

type HubTripCardProps = {
  href: string;
  title: string;
  dateRange?: string | null;
  memberCount: number;
  netBalance: number;
  imageUrl?: string | null;
};

function formatBalanceLabel(value: number) {
  const abs = Math.abs(value);
  const pretty = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(abs);
  if (value < 0) return { label: `You owe ${pretty}`, tone: "text-rose-700" };
  if (value > 0) return { label: `You are owed ${pretty}`, tone: "text-emerald-700" };
  return { label: "Settled up", tone: "text-slate-600" };
}

export default function HubTripCard({
  href,
  title,
  dateRange,
  memberCount,
  netBalance,
  imageUrl,
}: HubTripCardProps) {
  const balance = formatBalanceLabel(netBalance);

  return (
    <Link
      href={href}
      className="relative block touch-manipulation overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition active:bg-slate-50"
    >
      <span className="pointer-events-none absolute right-3 top-3 z-10 inline-flex rounded-full bg-white/90 p-1">
        <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
      </span>
      <div className="flex min-h-[116px]">
        <div className="min-w-0 flex-1 p-4 pr-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {dateRange ? <p className="mt-1 text-sm text-slate-500">{dateRange}</p> : null}
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">
              {memberCount} member{memberCount === 1 ? "" : "s"}
            </span>
            <span className={`font-medium ${balance.tone}`}>{balance.label}</span>
          </div>
        </div>
        <div className="relative w-[34%] max-w-[130px] shrink-0 self-stretch overflow-hidden border-l border-slate-100">
          {imageUrl ? (
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${imageUrl}")` }}
              aria-hidden
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-500 to-slate-700" aria-hidden />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      </div>
    </Link>
  );
}
