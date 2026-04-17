import type { VisaRecommendations as VisaRecommendationsType } from "@/app/app/visa/_lib/visa-data";

type VisaRecommendationsProps = {
  recommendations: VisaRecommendationsType;
};

function RecommendationBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-slate-700">
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VisaRecommendations({ recommendations }: VisaRecommendationsProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Best-practice recommendations</h2>
      <div className="mt-3 space-y-2.5">
        <RecommendationBlock title="Before applying" items={recommendations.beforeApply} />
        <RecommendationBlock title="While applying" items={recommendations.whileApplying} />
        <RecommendationBlock title="After applying" items={recommendations.afterApply} />
      </div>
    </section>
  );
}
