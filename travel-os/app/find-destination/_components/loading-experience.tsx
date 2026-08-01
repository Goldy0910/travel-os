"use client";

import { LOADING_STEPS } from "@/app/find-destination/_lib/quiz-constants";
import { useEffect, useState } from "react";

export default function LoadingExperience() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LOADING_STEPS.length);
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="flex min-h-[55vh] flex-col items-center justify-center px-4 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative mb-8 h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-teal-200/60" />
        <div className="absolute inset-2 animate-pulse rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 shadow-lg" />
        <div className="absolute inset-0 flex items-center justify-center text-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 12h18M12 3l9 9-9 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <h2 className="text-xl font-bold tracking-tight text-slate-900">
        Finding your perfect destination...
      </h2>
      <p className="mt-3 min-h-[1.5rem] text-sm font-medium text-teal-800 transition-opacity">
        {LOADING_STEPS[index]}
      </p>
      <div className="mt-8 w-full max-w-xs space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
