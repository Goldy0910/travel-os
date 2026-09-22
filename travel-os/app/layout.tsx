import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppToaster from "./_components/app-toaster";
import MobileInputFocusGuard from "./_components/mobile-input-focus-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travel Till 99 — Group Trips. Made Simple.",
  description:
    "Plan a trip with your friends without the chaos. Discover where to go, plan together, organize your itinerary and split expenses — all in one place.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MobileInputFocusGuard />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
