"use client";

import { PENDING_TRIP_INVITE_KEY } from "@/lib/pending-trip-invite";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

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

export default function JoinInviteClient({
  initialCode,
  preview,
  isLoggedIn,
  serverJoinError,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const goLoginWithPending = useCallback(() => {
    const code = initialCode.trim();
    if (code.length < 8) return;
    try {
      localStorage.setItem(PENDING_TRIP_INVITE_KEY, code);
    } catch {
      /* private mode */
    }
    router.push("/app/login");
  }, [initialCode, router]);

  const codeTooShort = initialCode.trim().length > 0 && initialCode.trim().length < 8;
  const codeMissing = initialCode.trim().length === 0;
  const invalidCode = !codeMissing && !codeTooShort && !preview.found;

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

        {preview.found && !isLoggedIn && !serverJoinError ? (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                goLoginWithPending();
              }}
              className="h-12 w-full rounded-xl bg-slate-900 text-base font-medium text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              Log in or sign up to join
            </button>
            <p className="text-center text-xs text-slate-500">
              We&apos;ll save this invite on this device until you&apos;re signed in.
            </p>
          </div>
        ) : null}

        {preview.found && isLoggedIn && serverJoinError ? (
          <div className="mt-8 space-y-3">
            <Link
              href="/app/home"
              className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white text-base font-medium text-slate-900"
            >
              Go to home
            </Link>
          </div>
        ) : null}

        <p className="mt-8 text-center text-sm text-slate-500">
          <Link href="/" className="font-medium text-slate-700 underline">
            Back to website
          </Link>
        </p>
      </div>
    </main>
  );
}
