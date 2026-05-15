import TripShareCard from "@/app/components/share/trip-share-card";
import type { PublicTripShareSnapshot } from "@/lib/trip-share/types";

type Props = {
  snapshot: PublicTripShareSnapshot;
  shareUrl: string;
  variant: "page" | "preview";
};

export default function PublicTripShareView({ snapshot, variant }: Props) {
  return (
    <TripShareCard
      snapshot={snapshot}
      variant={variant === "preview" ? "preview" : "page"}
    />
  );
}
