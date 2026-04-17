import type { VisaProcessStep } from "@/app/app/visa/_lib/visa-data";

type StepGuideProps = {
  steps: VisaProcessStep[];
};

export default function StepGuide({ steps }: StepGuideProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Step-by-step process</h2>
      <ol className="mt-3 space-y-2">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-xl border border-slate-200 bg-slate-50">
            <details>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-slate-900">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span>{step.title}</span>
              </summary>
              <div className="space-y-2 border-t border-slate-200 px-3 py-2">
                <p className="text-sm text-slate-600">{step.tip}</p>
                {step.link ? (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white"
                  >
                    Open official link
                  </a>
                ) : null}
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
