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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code")?.trim();
      if (code && code.length >= 8) {
        localStorage.setItem(PENDING_TRIP_INVITE_KEY, code);
      }
      const legacy = params.get("invite")?.trim();
      if (legacy && legacy.length >= 8) {
        localStorage.setItem(PENDING_TRIP_INVITE_KEY, legacy);
      }
    } catch {
      /* private mode / SSR */
    }
  }, []);

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    let supabase;
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
        } else if (data.session) {
          const wentToTrip = await tryConsumePendingInvite(supabase, router);
          if (!wentToTrip) {
            router.push(postLoginPath());
            router.refresh();
          }
        } else {
          setSuccessMessage("Signup successful. You can now log in.");
          setIsSignup(false);
          setPassword("");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setErrorMessage(error.message);
        } else {
          const wentToTrip = await tryConsumePendingInvite(supabase, router);
          if (!wentToTrip) {
            router.push(postLoginPath());
            router.refresh();
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
            {isSignup ? "Sign up to get started." : "Log in to continue."}
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

          {successMessage ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-xl bg-slate-900 text-base font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting
              ? isSignup
                ? "Creating account..."
                : "Logging in..."
              : isSignup
                ? "Sign up"
                : "Log in"}
          </button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-center text-sm text-slate-600"
          onClick={() => {
            setIsSignup(!isSignup);
            setErrorMessage("");
            setSuccessMessage("");
          }}
        >
          {isSignup
            ? "Already have an account? Log in"
            : "Need an account? Sign up"}
        </button>
      </div>
    </main>
  );
}