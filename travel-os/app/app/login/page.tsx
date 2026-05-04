"use client";

import BackLink from "@/app/app/_components/back-link";
import ButtonSpinner from "@/app/app/_components/button-spinner";
import { SetAppHeader } from "@/components/AppHeader";
import { tryConsumePendingInvite } from "@/lib/join-trip-invite";
import { PENDING_TRIP_INVITE_KEY } from "@/lib/pending-trip-invite";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useEffect, useId, useState } from "react";
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

const MIN_PASSWORD_LEN = 6;

export default function LoginPage() {
  const router = useRouter();
  const passwordHintId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** True after sign-in succeeds while we navigate away — keep loading until the next page mounts. */
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    persistInviteFromUrl();
  }, []);

  const finishAfterSession = async (
    supabase: ReturnType<typeof createSupabaseBrowserClient>,
  ) => {
    setIsRedirecting(true);
    const wentToTrip = await tryConsumePendingInvite(supabase, router);
    if (!wentToTrip) {
      router.push(postLoginPath());
      router.refresh();
    }
    // Intentionally do not clear isRedirecting — next route will unmount this view.
  };

  const handleAuth = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setInfoMessage("");
    setIsSubmitting(true);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

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

    let keepLoadingUntilUnmount = false;

    try {
      if (!email || !password) {
        setErrorMessage("Please enter both email and password.");
        return;
      }

      if (isSignup && password.length < MIN_PASSWORD_LEN) {
        setErrorMessage(
          `Password must be at least ${MIN_PASSWORD_LEN} characters.`,
        );
        return;
      }

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        if (data.session) {
          try {
            keepLoadingUntilUnmount = true;
            await finishAfterSession(supabase);
          } catch {
            keepLoadingUntilUnmount = false;
            setIsRedirecting(false);
            setErrorMessage("Couldn’t open the app. Try again.");
          }
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          setInfoMessage(
            "Check your inbox — we sent a confirmation link. After you confirm, use Log in below with the same email and password.",
          );
          setIsSignup(false);
          setPassword("");
          return;
        }
        try {
          keepLoadingUntilUnmount = true;
          await finishAfterSession(supabase);
        } catch {
          keepLoadingUntilUnmount = false;
          setIsRedirecting(false);
          setErrorMessage("Couldn’t open the app. Try again.");
        }
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
      try {
        keepLoadingUntilUnmount = true;
        await finishAfterSession(supabase);
      } catch {
        keepLoadingUntilUnmount = false;
        setIsRedirecting(false);
        setErrorMessage("Couldn’t open the app. Try again.");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      if (!keepLoadingUntilUnmount) {
        setIsSubmitting(false);
      }
    }
  };

  const busy = isSubmitting || isRedirecting;

  return (
    <>
      <SetAppHeader title={isSignup ? "Sign up" : "Log in"} showBack />
      <main className="flex min-h-screen flex-col items-center justify-start bg-slate-50 px-4 py-4 sm:py-8 md:justify-center md:py-10">
      <div className="mb-4 w-full max-w-md self-start sm:self-center">
        <BackLink href="/">Back to website</BackLink>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isSignup
              ? "Use an email you check regularly. Pick a password you’ll remember — then we take you straight into the app when your account is ready."
              : "Same email and password you used when you created your account."}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleAuth} aria-busy={busy}>
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
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-80"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={
                  isSignup ? "Choose a password" : "Enter your password"
                }
                className="h-12 w-full rounded-xl border border-slate-300 py-2 pl-4 pr-12 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-80"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                minLength={isSignup ? MIN_PASSWORD_LEN : undefined}
                disabled={busy}
                aria-describedby={isSignup ? passwordHintId : undefined}
                required
              />
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                disabled={busy}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" strokeWidth={2} aria-hidden />
                ) : (
                  <Eye className="h-5 w-5" strokeWidth={2} aria-hidden />
                )}
              </button>
            </div>
            {isSignup ? (
              <p
                id={passwordHintId}
                className="mt-1.5 text-xs leading-relaxed text-slate-500"
              >
                At least {MIN_PASSWORD_LEN} characters. Letters, numbers, and
                symbols are all fine.
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          {infoMessage ? (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-left shadow-sm"
              role="status"
            >
              <p className="text-sm font-semibold text-amber-950">
                One more step — check your email
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                {infoMessage}
              </p>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full min-h-[3rem] items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-90"
          >
            {busy ? (
              <>
                <ButtonSpinner className="h-5 w-5 shrink-0 text-white" />
                <span>
                  {isRedirecting
                    ? "Taking you there…"
                    : isSignup
                      ? "Creating your account…"
                      : "Logging in…"}
                </span>
              </>
            ) : isSignup ? (
              "Sign up & continue"
            ) : (
              "Log in"
            )}
          </button>
        </form>

        <button
          type="button"
          className="mt-5 w-full rounded-xl py-2.5 text-center text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
          onClick={() => {
            setIsSignup(!isSignup);
            setErrorMessage("");
            setInfoMessage("");
          }}
        >
          {isSignup ? (
            <>
              Already have an account?{" "}
              <span className="font-semibold text-teal-800 underline decoration-teal-300 underline-offset-[3px]">
                Log in
              </span>
            </>
          ) : (
            <>
              Need an account?{" "}
              <span className="font-semibold text-teal-800 underline decoration-teal-300 underline-offset-[3px]">
                Sign up
              </span>
            </>
          )}
        </button>
      </div>
    </main>
    </>
  );
}
