"use client";

import { useState } from "react";

type PlaceReview = {
  rating: number | null;
  text: string;
  author: string;
  relativeTime: string;
};

type Props = {
  reviews: PlaceReview[];
};

export default function ActivityReviews({ reviews }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  return (
    <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
      {reviews.map((review, idx) => {
        const isExpanded = !!expanded[idx];
        return (
          <article key={`${review.author}-${idx}`} className="rounded-2xl bg-slate-50 p-3.5">
            <p className="text-xs font-semibold text-slate-600">
              {review.author}
              {review.relativeTime ? ` · ${review.relativeTime}` : ""}
              {review.rating != null ? ` · ⭐ ${review.rating.toFixed(1)}` : ""}
            </p>
            <p className={`mt-1 text-sm text-slate-700 ${isExpanded ? "" : "line-clamp-3"}`}>
              {review.text}
            </p>
            {review.text.length > 140 ? (
              <button
                type="button"
                onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !isExpanded }))}
                className="mt-1 text-xs font-semibold text-indigo-600"
              >
                {isExpanded ? "Show less" : "Read more"}
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

