"use client";

type ProgressBarProps = {
  completed: number;
  total: number;
};

export default function ProgressBar({ completed, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  return (
    <div>
      <p className="text-sm font-medium text-slate-700">
        {completed}/{total} documents ready
      </p>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${percent}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}
