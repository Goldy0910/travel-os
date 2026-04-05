import { AppHeader, AppHeaderProvider } from "@/components/AppHeader";
import { Suspense } from "react";
import MobileBottomNav from "./_components/mobile-bottom-nav";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppHeaderProvider>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <AppHeader />
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
          {children}
        </div>
      </div>
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </AppHeaderProvider>
  );
}
