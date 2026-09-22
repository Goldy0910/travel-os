import type { Metadata } from "next";
import Footer from "./components/landing/Footer";
import LandingHome from "./components/landing/landing-home";
import Navbar from "./components/landing/Navbar";
import PublicShell from "./components/public-shell";
import StickyMobileCta from "./components/landing/StickyMobileCta";

export const metadata: Metadata = {
  title: "Travel Till 99 — Group Trips. Made Simple.",
  description:
    "Plan a trip with your friends without the chaos. Discover where to go, plan together, organize your itinerary and split expenses — all in one place.",
};

export default function HomePage() {
  return (
    <PublicShell footer={<StickyMobileCta />}>
      <Navbar />
      <main className="flex-1 pb-28 md:pb-8">
        <LandingHome />
        <Footer />
      </main>
    </PublicShell>
  );
}
