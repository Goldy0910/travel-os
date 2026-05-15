"use client";

type Props = {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

export default function HomepageStickyCta({ label, disabled, loading, onClick }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-5">
      <div className="pointer-events-auto min-w-0 w-full max-w-[420px] overflow-hidden rounded-t-2xl border border-b-0 border-slate-200 bg-white/95 p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.1)] backdrop-blur-md md:rounded-b-[2.5rem] md:border-b md:shadow-xl">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className="box-border flex min-h-12 w-full max-w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-base font-semibold text-white transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation"
        >
          {loading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : null}
          {label}
        </button>
      </div>
    </div>
  );
}
