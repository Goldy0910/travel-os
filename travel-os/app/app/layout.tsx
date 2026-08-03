import { AppHeader, AppHeaderProvider } from "@/components/AppHeader";
import { Suspense } from "react";
import MobileBottomNav from "./_components/mobile-bottom-nav";
import NoInternetModal from "./_components/no-internet-modal";
import { UserLocationProvider } from "./_components/user-location-provider";

/**
 * Authenticated app shell.
 * Mobile: header + scroll + bottom nav.
 * Desktop (md+): left sidebar + wider content (via CSS vars / travel-os-content).
 */
export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppHeaderProvider>
      <UserLocationProvider>
        <div className="flex h-dvh min-h-0 flex-col overflow-hidden md:flex-row">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <AppHeader />
            <div
              id="app-shell-scroll-root"
              className="relative min-h-0 flex-1 touch-pan-y overflow-x-clip overflow-y-auto overscroll-y-auto"
            >
              {children}
            </div>
          </div>
          <Suspense fallback={null}>
            <MobileBottomNav />
          </Suspense>
        </div>
        <NoInternetModal />
      </UserLocationProvider>
    </AppHeaderProvider>
  );
}
