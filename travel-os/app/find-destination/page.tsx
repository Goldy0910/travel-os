import FindDestinationFlow from "@/app/find-destination/_components/find-destination-flow";
import Footer from "@/app/components/landing/Footer";
import LandingLink from "@/app/components/landing/landing-link";
import Navbar from "@/app/components/landing/Navbar";
import PublicShell from "@/app/components/public-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Your Perfect Destination · Travel OS",
  description:
    "Not sure where to travel? Take a quick quiz and get personalized destination recommendations matched to your budget, weather, and interests.",
  openGraph: {
    title: "Find Your Perfect Destination · Travel OS",
    description:
      "Answer a few questions and discover three destinations that fit your travel vibe.",
    type: "website",
  },
};

export default function FindDestinationPage() {
  return (
    <PublicShell>
      <Navbar />
      <main className="flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] px-4 pb-10 pt-4 md:px-10">
        <div className="mx-auto w-full max-w-3xl md:max-w-5xl">
          <div className="mb-3">
            <LandingLink
              href="/"
              className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              ← Back to home
            </LandingLink>
          </div>
          <FindDestinationFlow />
        </div>
      </main>
      <Footer />
    </PublicShell>
  );
}
