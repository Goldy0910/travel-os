import { Suspense } from "react";
import MobileBottomNav from "./_components/mobile-bottom-nav";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </>
  );
}
