import type { Metadata } from "next";
import type { PublicTripShareSnapshot } from "@/lib/trip-share/types";

export function buildPublicTripShareMetadata(
  snapshot: PublicTripShareSnapshot,
  pageUrl: string,
): Metadata {
  const title = `${snapshot.destination.name} · ${snapshot.durationDays}-day trip`;
  const description =
    snapshot.whyItFits.slice(0, 2).join(" ") ||
    `A ${snapshot.durationDays}-day plan for ${snapshot.destination.name}.`;

  const ogImage =
    snapshot.heroImageAbsolute ??
    (snapshot.heroImageUrl?.startsWith("http") ? snapshot.heroImageUrl : undefined);

  return {
    title: `${title} | TravelTill99`,
    description,
    openGraph: {
      type: "website",
      url: pageUrl,
      siteName: "TravelTill99",
      title,
      description,
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                width: 1200,
                height: 630,
                alt: snapshot.destination.name,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}
