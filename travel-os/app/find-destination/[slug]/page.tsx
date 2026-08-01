import DestinationDetailsView from "@/app/find-destination/_components/destination-details-view";
import Footer from "@/app/components/landing/Footer";
import LandingLink from "@/app/components/landing/landing-link";
import Navbar from "@/app/components/landing/Navbar";
import PublicShell from "@/app/components/public-shell";
import {
  getAllDestinationSlugs,
  getDestinationBySlug,
} from "@/lib/find-destination/catalog";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllDestinationSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dest = getDestinationBySlug(slug);
  if (!dest) {
    return { title: "Destination · Travel OS" };
  }
  const title = `${dest.name}, ${dest.country} · Find Your Perfect Destination`;
  const description = dest.shortDescription;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: dest.imageUrl, alt: dest.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [dest.imageUrl],
    },
  };
}

export default async function DestinationDetailsPage({ params }: PageProps) {
  const { slug } = await params;
  const destination = getDestinationBySlug(slug);
  if (!destination) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: destination.name,
    description: destination.shortDescription,
    image: destination.imageUrl,
    address: {
      "@type": "PostalAddress",
      addressCountry: destination.country,
    },
  };

  return (
    <PublicShell>
      <Navbar />
      <main className="flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] px-4 pb-8 pt-4 md:px-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-3">
            <LandingLink
              href="/find-destination"
              className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              ← All recommendations
            </LandingLink>
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
          <Suspense
            fallback={
              <div className="h-64 animate-pulse rounded-3xl bg-slate-100" aria-hidden />
            }
          >
            <DestinationDetailsView destination={destination} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </PublicShell>
  );
}
