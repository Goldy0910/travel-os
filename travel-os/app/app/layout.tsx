import { AppHeader, AppHeaderProvider } from "@/components/AppHeader";
import { Suspense } from "react";
import MobileBottomNav from "./_components/mobile-bottom-nav";
import NoInternetModal from "./_components/no-internet-modal";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppHeaderProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
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
      <NoInternetModal />
    </AppHeaderProvider>
  );
}
