"use client";

import ButtonSpinner from "@/app/app/_components/button-spinner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { upsertProfileOrUserMetadata } from "@/lib/profiles-fallback";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

const PROFILE_BUCKET = "profile-images";

function initialsFromName(name: string, email: string) {
  const base = name.trim() || email.trim() || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

type Props = {
  userId: string;
  email: string;
  initialName: string;
  initialAvatarUrl: string | null;
};

export default function SettingsClient({
  userId,
  email,
  initialName,
  initialAvatarUrl,
}: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const upsertProfileRow = async (row: {
    name: string | null;
    avatar_url: string | null;
  }) => {
    const supabase = createSupabaseBrowserClient();
    await upsertProfileOrUserMetadata(supabase, userId, row);
  };

  const onPickAvatar = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      const msg = "Please choose an image file.";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      const msg = "Image must be 4MB or smaller.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setError("");
    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `${userId}/avatar.png`;
      const { error: upStorage } = await supabase.storage
        .from(PROFILE_BUCKET)
        .upload(path, file, {
          upsert: true,
          contentType: file.type || "image/png",
          cacheControl: "3600",
        });
      if (upStorage) throw upStorage;

      const {
        data: { publicUrl },
      } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
      const busted = `${publicUrl}?t=${Date.now()}`;
      setAvatarUrl(busted);

      await upsertProfileRow({
        name: name.trim() || null,
        avatar_url: publicUrl,
      });
      toast.success("Profile photo updated.");
      router.refresh();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not upload image.";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const onSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const stableUrl = avatarUrl?.split("?")[0] ?? null;
      await upsertProfileRow({
        name: name.trim() || null,
        avatar_url: stableUrl,
      });
      toast.success("Profile updated.");
      router.refresh();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not save profile.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    setLoggingOut(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      toast.success("Signed out.");
      router.push("/app/login");
      router.refresh();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Could not log out.";
      setError(msg);
      toast.error(msg);
      setLoggingOut(false);
    }
  };

  const displayInitials = initialsFromName(name, email);
  const cleanAvatar = avatarUrl?.split("?")[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-md space-y-8 px-4 py-6 pb-28">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/app/home"
          className="min-h-11 text-sm font-semibold text-slate-600 underline-offset-2 hover:underline"
        >
          ← Home
        </Link>
      </div>

      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Your profile and account</p>
      </header>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Profile</h2>

        <div className="mt-6 flex flex-col items-center">
          <div className="relative h-28 w-28 overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 ring-4 ring-slate-100">
            {cleanAvatar ? (
              // User avatar URL is project-specific Supabase Storage; skip next/image remote config.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl!}
                alt=""
                width={112}
                height={112}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                {displayInitials}
              </span>
            )}
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 text-xs font-semibold text-white">
                Uploading…
              </div>
            ) : null}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={onFileChange}
          />
          <button
            type="button"
            onClick={onPickAvatar}
            disabled={uploading}
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-slate-900 bg-white px-6 text-sm font-semibold text-slate-900 shadow-sm transition active:scale-[0.99] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <ButtonSpinner className="h-4 w-4 text-slate-900" />
                Uploading…
              </>
            ) : (
              "Change photo"
            )}
          </button>
        </div>

        <form onSubmit={onSaveName} className="mt-8 space-y-5">
          <div>
            <label htmlFor="display-name" className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Name
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              autoComplete="name"
              placeholder="Your name"
              className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-900 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={saving || uploading}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-base font-semibold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? (
              <>
                <ButtonSpinner className="h-4 w-4 text-white" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Account</h2>
        <p className="mt-2 text-sm text-slate-600">{email}</p>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 text-base font-semibold text-rose-800 transition active:scale-[0.99] disabled:opacity-50"
        >
          {loggingOut ? (
            <>
              <ButtonSpinner className="h-4 w-4 text-rose-800" />
              Logging out…
            </>
          ) : (
            "Logout"
          )}
        </button>
      </section>
    </div>
  );
}
