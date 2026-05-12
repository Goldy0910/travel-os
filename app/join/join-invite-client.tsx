"use client";

import LinkLoadingIndicator from "@/app/_components/link-loading-indicator";
import { PENDING_TRIP_INVITE_KEY } from "@/lib/pending-trip-invite";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type InvitePreviewPayload = {
  found: boolean;
  trip_id?: string;
  title?: string;
  location?: string;
};

type Props = {
  initialCode: string;
  preview: InvitePreviewPayload;
  isLoggedIn: boolean;
  serverJoinError: string | null;
};

function computePhase(
  code: string,
  preview: InvitePreviewPayload,
  isLoggedIn: boolean,
  serverJoinError: string | null,
): "idle" | "to_login" | "joining" {
  const codeMissing = code.length === 0;
  const codeTooShort = code.length > 0 && code.length < 8;
  const invalidCode = !codeMissing && !codeTooShort && !preview.found;
  if (codeMissing || codeTooShort || serverJoinError || invalidCode) return "idle";
  if (preview.found && code.length >= 8) {
    return isLoggedIn ? "joining" : "to_login";
  }
  return "idle";
}

export default function JoinInviteClient({
  initialCode,
  preview,
  isLoggedIn,
  serverJoinError,
}: Props) {
  const router = useRouter();
  const redirected = useRef(false);
  const code = initialCode.trim();

  const [phase, setPhase] = useState(() =>
    computePhase(code, preview, isLoggedIn, serverJoinError),
  );

  const codeMissing = code.length === 0;
  const codeTooShort = code.length > 0 && code.length < 8;
  const invalidCode = !codeMissing && !codeTooShort && !preview.found;

  useEffect(() => {
    setPhase(computePhase(code, preview, isLoggedIn, serverJoinError));
  }, [code, preview, isLoggedIn, serverJoinError]);

  useEffect(() => {
    if (phase !== "to_login") return;
    if (redirected.current) return;
    redirected.current = true;
    try {
      localStorage.setItem(PENDING_TRIP_INVITE_KEY, code);
    } catch {
      /* private mode */
    }
    router.replace(`/app/login?code=${encodeURIComponent(code)}`);
  }, [phase, code, router]);

  if (phase === "to_login" || phase === "joining") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900"
            aria-hidden
          />
          <p className="text-base font-medium text-slate-800">
            {phase === "joining" ? "Joining trip…" : "Taking you to sign in…"}
          </p>
          <p className="text-sm text-slate-500">
            {phase === "joining"
              ? "Almost there."
              : "You’ll join automatically right after you log in or sign up."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-semibold text-slate-900">Join a trip</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use an invite link from your trip organizer to get access.
        </p>

        {codeMissing ? (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This link is missing an invite code. Ask your organizer for the full invite link.
          </p>
        ) : null}

        {codeTooShort ? (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            That invite code looks too short. Check the link and try again.
          </p>
        ) : null}

        {serverJoinError ? (
          <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {serverJoinError}
          </p>
        ) : null}

        {!serverJoinError && invalidCode ? (
          <p className="mt-6 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            We could not find a trip for this invite. It may have expired or been replaced.
          </p>
        ) : null}

        {preview.found ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              You&apos;re invited to
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {preview.title ?? "Trip"}
            </p>
            {preview.location ? (
              <p className="mt-1 text-sm text-slate-600">{preview.location}</p>
            ) : null}
          </div>
        ) : null}

        {serverJoinError && isLoggedIn ? (
          <div className="mt-8">
            <Link
              href="/app/home"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-base font-medium text-slate-900"
            >
              Go to home
              <LinkLoadingIndicator spinnerClassName="h-4 w-4 text-slate-700" />
            </Link>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-medium text-slate-700 underline"
          >
            Back to website
            <LinkLoadingIndicator spinnerClassName="h-3.5 w-3.5 text-slate-600" />
          </Link>
        </p>
      </div>
    </main>
  );
}
