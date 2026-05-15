"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useId, useState } from "react";

const MIN_PASSWORD_LEN = 6;

type Props = {
  onAuthenticated: () => void | Promise<void>;
  compact?: boolean;
};

export default function InlineAuthForm({ onAuthenticated, compact }: Props) {
  const passwordHintId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const busy = isSubmitting || isRedirecting;

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

    let keepLoading = false;
    try {
      if (!email || !password) {
        setErrorMessage("Please enter both email and password.");
        return;
      }
      if (isSignup && password.length < MIN_PASSWORD_LEN) {
        setErrorMessage(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
        return;
      }

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setErrorMessage(error.message);
          return;
        }
        if (!data.session) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) {
            setInfoMessage(
              "Check your inbox for a confirmation link, then log in with the same email.",
            );
            setIsSignup(false);
            setPassword("");
            return;
          }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setErrorMessage(error.message);
          return;
        }
      }

      keepLoading = true;
      setIsRedirecting(true);
      await onAuthenticated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setIsRedirecting(false);
    } finally {
      if (!keepLoading) setIsSubmitting(false);
    }
  };

  return (
    <form className={compact ? "space-y-3" : "space-y-4"} onSubmit={handleAuth} aria-busy={busy}>
      <div className="rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-sm text-teal-950">
        <p className="font-medium">Your trip plan is saved on this device</p>
        <p className="mt-1 text-teal-900/90">
          Sign in to continue planning — we&apos;ll pick up right where you left off.
        </p>
      </div>

      <div>
        <label htmlFor="inline-auth-email" className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="inline-auth-email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:opacity-70"
        />
      </div>

      <div>
        <label
          htmlFor="inline-auth-password"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="inline-auth-password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            disabled={busy}
            minLength={isSignup ? MIN_PASSWORD_LEN : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignup ? "Choose a password" : "Your password"}
            aria-describedby={isSignup ? passwordHintId : undefined}
            className="h-12 w-full rounded-xl border border-slate-300 py-2 pl-4 pr-12 text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:opacity-70"
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={busy}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {isSignup ? (
          <p id={passwordHintId} className="mt-1 text-xs text-slate-500">
            At least {MIN_PASSWORD_LEN} characters.
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{errorMessage}</p>
      ) : null}
      {infoMessage ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{infoMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-base font-semibold text-white disabled:opacity-80"
      >
        {busy ? (
          <>
            <ButtonSpinner className="h-5 w-5 text-white" />
            {isRedirecting ? "Continuing your trip…" : isSignup ? "Creating account…" : "Signing in…"}
          </>
        ) : isSignup ? (
          "Sign up & continue"
        ) : (
          "Log in & continue"
        )}
      </button>

      <button
        type="button"
        className="w-full py-2 text-center text-sm text-slate-600"
        disabled={busy}
        onClick={() => {
          setIsSignup(!isSignup);
          setErrorMessage("");
          setInfoMessage("");
        }}
      >
        {isSignup ? (
          <>
            Already have an account?{" "}
            <span className="font-semibold text-teal-800 underline">Log in</span>
          </>
        ) : (
          <>
            New here?{" "}
            <span className="font-semibold text-teal-800 underline">Create account</span>
          </>
        )}
      </button>
    </form>
  );
}
