import Link from "next/link";
import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";

type HubExpenseItemProps = {
  tripName: string;
  netBalance: number;
  breakdownLines: string[];
  href: string;
};

function inr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));
}

function netLabel(value: number) {
  if (value < 0) return `You owe ${inr(value)}`;
  if (value > 0) return `You are owed ${inr(value)}`;
  return "Settled up";
}

export default function HubExpenseItem({
  tripName,
  netBalance,
  breakdownLines,
  href,
}: HubExpenseItemProps) {
  return (
    <Link
      href={href}
      className="relative block rounded-2xl border border-slate-200 bg-white p-4 pr-12 shadow-sm transition active:bg-slate-50"
    >
      <span className="pointer-events-none absolute right-3 top-3 inline-flex">
        <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
      </span>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{tripName}</h3>
        <p
          className={`text-right text-xs font-semibold ${netBalance < 0 ? "text-rose-700" : netBalance > 0 ? "text-emerald-700" : "text-slate-500"}`}
        >
          {netLabel(netBalance)}
        </p>
      </div>
      <ul className="mt-2 space-y-1">
        {breakdownLines.slice(0, 3).map((line) => (
          <li key={line} className="text-xs text-slate-600">
            {line}
          </li>
        ))}
      </ul>
    </Link>
  );
}
