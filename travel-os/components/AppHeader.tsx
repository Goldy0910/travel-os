"use client";

import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const HEADER_H = "3.5rem"; /* 56px */

export type AppHeaderOverride = {
  title: string;
  showBack: boolean;
};

type AppHeaderContextValue = {
  override: AppHeaderOverride | null;
  setOverride: (v: AppHeaderOverride | null) => void;
};

const AppHeaderContext = createContext<AppHeaderContextValue | null>(null);

function useAppHeaderContext() {
  const ctx = useContext(AppHeaderContext);
  if (!ctx) {
    throw new Error("useAppHeaderContext must be used within AppHeaderProvider");
  }
  return ctx;
}

function defaultHeaderForPath(pathname: string): AppHeaderOverride {
  const path = pathname.split("?")[0] ?? pathname;

  if (path === "/app/home") {
    return { title: "Travel Till 99", showBack: false };
  }
  if (path === "/app/dashboard") {
    return { title: "Travel Till 99", showBack: false };
  }
  if (path === "/app/trips") {
    return { title: "Trips", showBack: true };
  }
  if (path === "/app/create-trip") {
    return { title: "Create trip", showBack: true };
  }
  if (path === "/app/settings") {
    return { title: "Settings", showBack: true };
  }
  if (path === "/app/login") {
    return { title: "Log in", showBack: true };
  }
  if (path === "/app/docs") {
    return { title: "Documents", showBack: true };
  }
  if (path === "/app/expenses") {
    return { title: "Expenses", showBack: true };
  }

  const m = /^\/app\/trip\/[^/]+\/(docs|expenses|members|chat|guides)$/.exec(path);
  if (m) {
    const map: Record<string, string> = {
      docs: "Documents",
      expenses: "Expenses",
      members: "Members",
      chat: "Chat",
      guides: "Explore",
    };
    return { title: map[m[1] ?? ""] ?? "Trip", showBack: true };
  }

  if (/^\/app\/trip\/[^/]+$/.test(path)) {
    return { title: "Trip", showBack: true };
  }

  return { title: "Travel Till 99", showBack: true };
}

export function AppHeaderProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<AppHeaderOverride | null>(null);
  const value = useMemo(
    () => ({ override, setOverride }),
    [override],
  );
  return (
    <AppHeaderContext.Provider value={value}>{children}</AppHeaderContext.Provider>
  );
}

/** Call from server pages via this client boundary to set title / back for the current route. */
export function SetAppHeader({ title, showBack }: AppHeaderOverride) {
  const { setOverride } = useAppHeaderContext();

  useLayoutEffect(() => {
    setOverride({ title, showBack });
    return () => setOverride(null);
  }, [title, showBack, setOverride]);

  return null;
}

export function AppHeader() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { override } = useAppHeaderContext();

  const defaults = useMemo(() => defaultHeaderForPath(pathname), [pathname]);
  const title = override?.title ?? defaults.title;
  const showBack = override?.showBack ?? defaults.showBack;

  const onBack = () => {
    router.back();
  };

  return (
    <header
      className="sticky top-0 z-[120] border-b border-slate-200/70 bg-gradient-to-b from-white/95 to-white/90 shadow-[0_6px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/85"
      style={{ minHeight: HEADER_H }}
    >
      <div
        className="mx-auto flex h-14 max-w-md items-center gap-2 px-4 pt-[max(0px,env(safe-area-inset-top))]"
        style={{ minHeight: HEADER_H }}
      >
        <div className="flex w-10 shrink-0 justify-start">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5 stroke-[2.25]" />
            </button>
          ) : (
            <span className="min-w-10" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 px-1 text-center">
          <h1 className="truncate text-[1.05rem] font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
        </div>

        <div className="w-10 shrink-0" aria-hidden />
      </div>
    </header>
  );
}
