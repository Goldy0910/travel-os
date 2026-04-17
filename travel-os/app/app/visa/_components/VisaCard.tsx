import type { VisaInfo } from "@/app/app/visa/_lib/visa-data";

type VisaCardProps = {
  destination: string;
  info: VisaInfo;
  tripDurationDays: number | null;
};

export default function VisaCard({ destination, info, tripDurationDays }: VisaCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg" aria-hidden>
          🌍
        </span>
        <h2 className="text-base font-semibold text-slate-900">Visa requirement - {destination}</h2>
      </div>
      <dl className="grid grid-cols-1 gap-2 text-sm text-slate-700">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Visa type</dt>
          <dd className="mt-1 font-medium text-slate-900">{info.visaType}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Your planned duration</dt>
          <dd className="mt-1 font-medium text-slate-900">
            {tripDurationDays ? `${tripDurationDays} day(s)` : "Trip dates not set"}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Estimated cost</dt>
          <dd className="mt-1 font-medium text-slate-900">{info.cost}</dd>
          <a
            href={info.costSourceLink}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold text-slate-700 underline"
          >
            Cost source
          </a>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Processing time</dt>
          <dd className="mt-1 font-medium text-slate-900">{info.processingTime}</dd>
        </div>
      </dl>
      <a
        href={info.applyLink}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white active:scale-[0.98]"
      >
        Apply Now
      </a>
    </section>
  );
}
