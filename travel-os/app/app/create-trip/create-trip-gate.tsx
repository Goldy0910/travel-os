"use client";

import BottomSheetModal from "@/app/app/_components/bottom-sheet-modal";
import InlineAuthForm from "@/app/app/_components/inline-auth-form";
import CreateTripForm from "@/app/app/create-trip/create-trip-form";
import type { TravelPlaceDTO } from "@/app/app/create-trip/travel-place-types";
import {
  loadRecommendationSession,
  tryConsumePendingRecommendation,
} from "@/lib/recommendation-session";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type CreateTripPrefill = {
  slug?: string;
  query?: string;
  days?: number;
};

type Props = {
  places: TravelPlaceDTO[];
  destinationsLoaded: boolean;
  initialPrefill?: CreateTripPrefill;
  error?: string;
};

export default function CreateTripGate({
  places,
  destinationsLoaded,
  initialPrefill,
  error,
}: Props) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const session = loadRecommendationSession();
  const destinationLabel =
    session?.decision.mode === "recommendation"
      ? session.decision.destination
      : session?.decision.destination;

  const checkAuth = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsAuthed(Boolean(user));
      if (!user && session) setAuthOpen(true);
    } catch {
      setIsAuthed(false);
    } finally {
      setAuthChecked(true);
    }
  }, [session]);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const afterAuth = useCallback(async () => {
    setIsAuthed(true);
    setAuthOpen(false);
    const consumed = await tryConsumePendingRecommendation(router);
    if (!consumed) {
      router.refresh();
    }
  }, [router]);

  if (!authChecked) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <>
      {session && isAuthed ? (
        <div className="mb-4 flex gap-3 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm text-teal-950">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden />
          <div>
            <p className="font-semibold">Picked up your recommendation</p>
            <p className="mt-0.5 text-teal-900/90">
              Destination and dates are prefilled from your homepage plan.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {isAuthed ? (
        <CreateTripForm
          places={places}
          destinationsLoaded={destinationsLoaded}
          initialPrefill={initialPrefill}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-800">Sign in to create your trip</p>
          <p className="mt-1 text-sm text-slate-500">
            Your recommendation is saved — we&apos;ll prefill everything after you log in.
          </p>
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white touch-manipulation"
          >
            Continue
          </button>
        </div>
      )}

      <BottomSheetModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Sign in to create trip"
        description={
          destinationLabel
            ? `Finish setting up your ${destinationLabel} trip.`
            : "Your plan is ready — sign in to continue."
        }
        panelClassName="max-h-[min(88dvh,720px)]"
      >
        <InlineAuthForm onAuthenticated={afterAuth} compact />
      </BottomSheetModal>
    </>
  );
}
