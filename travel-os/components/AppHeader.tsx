"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ChevronLeft, LogOut, MoreVertical, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
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
      guides: "Guides",
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [userHint, setUserHint] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaults = useMemo(() => defaultHeaderForPath(pathname), [pathname]);
  const title = override?.title ?? defaults.title;
  const showBack = override?.showBack ?? defaults.showBack;

  useEffect(() => {
    queueMicrotask(() => {
      setMenuOpen(false);
      setSheetVisible(false);
    });
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const id = requestAnimationFrame(() => setSheetVisible(true));
    return () => cancelAnimationFrame(id);
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        const metaName = user.user_metadata?.full_name;
        const hint =
          (typeof metaName === "string" ? metaName.trim() : "") ||
          user.email?.trim() ||
          null;
        setUserHint(hint);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeMenu = useCallback(() => {
    setSheetVisible(false);
    closeTimer.current = setTimeout(() => setMenuOpen(false), 200);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      const sheet = document.getElementById("app-header-menu-sheet");
      if (sheet?.contains(t)) return;
      const drop = document.getElementById("app-header-menu-dropdown");
      if (drop?.contains(t)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [menuOpen, closeMenu]);

  const onBack = () => {
    router.back();
  };

  const initials = useMemo(() => {
    if (!userHint) return "";
    const s = userHint.trim();
    if (s.includes("@")) {
      return s.slice(0, 2).toUpperCase();
    }
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    }
    return s.slice(0, 2).toUpperCase();
  }, [userHint]);

  return (
    <>
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

          <div className="flex w-10 shrink-0 justify-end">
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label="Open menu"
              onClick={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current);
                setMenuOpen((o) => !o);
              }}
              className="flex min-h-10 min-w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
            >
              {initials ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-semibold text-white ring-1 ring-white">
                  {initials}
                </span>
              ) : (
                <MoreVertical className="h-5 w-5" strokeWidth={2.25} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Desktop dropdown */}
      {menuOpen ? (
        <div
          id="app-header-menu-dropdown"
          className="fixed right-4 top-[calc(3.5rem+env(safe-area-inset-top)+0.35rem)] z-[130] hidden min-w-[14rem] rounded-2xl border border-slate-200/90 bg-white/95 py-2 shadow-2xl shadow-slate-900/15 backdrop-blur-md md:block"
        >
          <MenuPanelContent
            userHint={userHint}
            initials={initials}
            onNavigate={() => {
              setMenuOpen(false);
              setSheetVisible(false);
            }}
          />
        </div>
      ) : null}

      {/* Mobile bottom sheet */}
      {menuOpen ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className={`fixed inset-0 z-[125] bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-200 md:hidden ${
              sheetVisible ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeMenu}
          />
          <div
            id="app-header-menu-sheet"
            className={`fixed inset-x-0 bottom-0 z-[126] rounded-t-3xl border border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_rgba(15,23,42,0.16)] backdrop-blur-md transition-transform duration-200 ease-out md:hidden ${
              sheetVisible ? "translate-y-0" : "translate-y-full"
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            <MenuPanelContent
              userHint={userHint}
              initials={initials}
              onNavigate={() => {
                setMenuOpen(false);
                setSheetVisible(false);
              }}
              largeTouch
            />
          </div>
        </>
      ) : null}
    </>
  );
}

function MenuPanelContent({
  userHint,
  initials,
  onNavigate,
  largeTouch,
}: {
  userHint: string | null;
  initials: string;
  onNavigate: () => void;
  largeTouch?: boolean;
}) {
  const pad = largeTouch ? "min-h-14 px-4 py-3.5 text-base" : "min-h-11 px-4 py-2.5 text-sm";
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      onNavigate();
      router.push("/app/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, onNavigate, router]);

  return (
    <div className="flex flex-col">
      {userHint ? (
        <div
          className={`flex items-center gap-3 border-b border-slate-100 ${largeTouch ? "px-4 py-4" : "px-4 py-3"}`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white">
            {initials ? (
              <span>{initials}</span>
            ) : (
              <UserRound className="h-5 w-5 text-white/90" strokeWidth={2} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
              Signed in
            </p>
            <p className="truncate text-sm font-medium text-slate-900">{userHint}</p>
          </div>
        </div>
      ) : null}
      <Link
        href="/settings"
        onClick={onNavigate}
        className={`flex items-center gap-3 font-medium text-slate-800 transition hover:bg-slate-50 active:bg-slate-100 ${pad}`}
      >
        <Settings className="h-5 w-5 shrink-0 text-slate-500" strokeWidth={2} />
        Settings
      </Link>
      <button
        type="button"
        onClick={onLogout}
        disabled={loggingOut}
        className={`flex items-center gap-3 border-t border-slate-100 font-medium text-rose-700 transition hover:bg-rose-50 active:bg-rose-100 disabled:opacity-60 ${pad}`}
      >
        <LogOut className="h-5 w-5 shrink-0 text-rose-600" strokeWidth={2} />
        {loggingOut ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}
