"use client";

import BackLink from "@/app/app/_components/back-link";
import { tryConsumePendingInvite } from "@/lib/join-trip-invite";
import { PENDING_TRIP_INVITE_KEY } from "@/lib/pending-trip-invite";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function postLoginPath(): string {
  try {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (!raw?.trim()) return "/app/home";
    const decoded = decodeURIComponent(raw.trim());
    if (!decoded.startsWith("/app") || decoded.startsWith("/app/login")) {
      return "/app/home";
    }
    if (decoded.startsWith("//")) return "/app/home";
    return decoded;
  } catch {
    return "/app/home";
  }
}

/** Persist invite from ?code=, ?invite=, or ?next=/join?code=… */
function persistInviteFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const tryStore = (c: string | undefined) => {
      const t = c?.trim() ?? "";
      if (t.length >= 8) {
        localStorage.setItem(PENDING_TRIP_INVITE_KEY, t);
        return true;
      }
      return false;
    };
    if (tryStore(params.get("code") ?? undefined)) return;
    if (tryStore(params.get("invite") ?? undefined)) return;
    const next = params.get("next")?.trim();
    if (next) {
      const url = new URL(next, window.location.origin);
      if (tryStore(url.searchParams.get("code") ?? undefined)) return;
    }
  } catch {
    /* private mode / invalid next */
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joiningTrip, setJoiningTrip] = useState(false);

  useEffect(() => {
    persistInviteFromUrl();
  }, []);

  const finishAfterSession = async (supabase: ReturnType<typeof createSupabaseBrowserClient>) => {
    setJoiningTrip(true);
    try {
      const wentToTrip = await tryConsumePendingInvite(supabase, router);
      if (!wentToTrip) {
        router.push(postLoginPath());
        router.refresh();
      }
    } finally {
      setJoiningTrip(false);
    }
  };

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setIsSubmitting(true);

    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not initialize auth.",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      if (!email || !password) {
        setErrorMessage("Please enter both email and password.");
        return;
      }

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        if (data.session) {
          await finishAfterSession(supabase);
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setInfoMessage(
            "Account created. If you don’t get in automatically, confirm your email or ask your admin to disable “Confirm email” in Supabase (Auth → Providers → Email) for instant beta access.",
          );
          setIsSignup(false);
          setPassword("");
          return;
        }
        await finishAfterSession(supabase);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      await finishAfterSession(supabase);
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = isSubmitting || joiningTrip;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="mb-6 w-full max-w-md self-start sm:self-center">
        <BackLink href="/">Back to website</BackLink>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isSignup
              ? "Email and password — you’ll jump straight into the trip after this."
              : "Log in to continue to your trip."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth}>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {infoMessage ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {infoMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="h-12 w-full rounded-xl bg-slate-900 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {joiningTrip
              ? "Joining trip…"
              : isSubmitting
                ? isSignup
                  ? "Creating account…"
                  : "Logging in…"
                : isSignup
                  ? "Sign up & continue"
                  : "Log in"}
          </button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-slate-600"
          onClick={() => {
            setIsSignup(!isSignup);
            setErrorMessage("");
            setInfoMessage("");
          }}
        >
          {isSignup
            ? "Already have an account? Log in"
            : "Need an account? Sign up"}
        </button>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Beta: turn off <strong className="font-medium text-slate-600">Confirm email</strong> in
          Supabase (Authentication → Providers → Email) so sign-up logs in immediately.
        </p>
      </div>
    </main>
  );
}
