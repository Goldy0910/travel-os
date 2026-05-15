import PublicTripShareView from "@/app/components/share/public-trip-share-view";
import { buildPublicTripShareMetadata } from "@/lib/trip-share/metadata";
import { loadPublicTripShareByToken } from "@/lib/trip-share/load-public-share";
import { tripShareUrl } from "@/lib/trip-share/urls";
import { getResolvedPublicSiteUrl } from "@/lib/public-site-url";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const snapshot = await loadPublicTripShareByToken(token);
  if (!snapshot) {
    return {
      title: "Trip not found | TravelTill99",
      robots: { index: false, follow: false },
    };
  }
  const baseUrl = await getResolvedPublicSiteUrl();
  return buildPublicTripShareMetadata(snapshot, tripShareUrl(token, baseUrl));
}

export default async function PublicTripSharePage({ params }: PageProps) {
  const { token } = await params;
  const snapshot = await loadPublicTripShareByToken(token);
  if (!snapshot) notFound();

  const baseUrl = await getResolvedPublicSiteUrl();
  const shareUrl = tripShareUrl(token, baseUrl);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="safe-area-inset-top sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-white touch-manipulation"
          >
            TravelTill99
          </Link>
          <span className="text-xs font-medium uppercase tracking-wider text-teal-300/90">
            Shared trip
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-6 pb-10">
        <PublicTripShareView snapshot={snapshot} shareUrl={shareUrl} variant="page" />
      </main>

      <footer className="border-t border-white/10 px-4 py-8">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-sm text-slate-400">
            Plan your next trip with confidence — recommendations, validation, and itineraries.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-2xl bg-teal-500 px-6 text-sm font-semibold text-slate-950 touch-manipulation"
          >
            Try TravelTill99
          </Link>
        </div>
      </footer>
    </div>
  );
}
