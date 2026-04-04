# Deploy Travel OS on Vercel

## Fix: “Root Directory `travel-os/package.json` does not exist”

Vercel’s **Root Directory** must be a **folder name**, not a file.

| Wrong                         | Correct    |
|------------------------------|------------|
| `travel-os/package.json`     | `travel-os` |
| `./travel-os/package.json`   | `travel-os` |

Steps:

1. Vercel → your project → **Settings** → **General**.
2. **Root Directory** → **Edit** → set to: **`travel-os`** (exactly that, no `package.json`, no leading `./`).
3. Save, then **Redeploy**.

## Why there are two `package.json` files

- **`Travel Till 99/package.json`** — monorepo **workspace root**: scripts that delegate to the app (`npm run dev` → `travel-os`). It is **not** the Next.js app Vercel should build by itself unless you leave Root Directory empty and add custom commands (not recommended).
- **`travel-os/package.json`** — the **Next.js app** Vercel should install and build.

Deploy with **Root Directory = `travel-os`** so Vercel uses only the app’s `package.json` and `travel-os/vercel.json`.

## Environment variables

In Vercel → **Settings** → **Environment Variables**, add everything your app reads from `.env.local`, for example:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_DOCS_BUCKET` (if used)
- `NEXT_PUBLIC_SITE_URL` (recommended) — your canonical URL (e.g. `https://yourdomain.com`). Invite links on the members page use this.
  - If unset, Vercel still sets **`VERCEL_URL`** at runtime and the app builds invite links as **`https://<your-deployment>.vercel.app`** automatically.
  - **`http://localhost:3000` only appears in local dev** — that’s normal; friends can’t open your laptop. Use your deployed URL to share invites.

### Supabase Auth (beta: frictionless sign-up)

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Providers** → **Email**:

- Turn **Confirm email** **OFF** so new users get a session immediately after sign-up (email + password only).
- No magic links or OTP are required by this app.

Invite flow: guest opens `/join?code=…` → sign-in screen → after login, `join_trip_by_invite_code` runs and they land on the trip.

## Node version

Use **Node 20+** (Vercel → Settings → General → Node.js Version, or rely on `engines` in `package.json`).
