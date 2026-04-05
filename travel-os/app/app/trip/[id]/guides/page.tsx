import { redirect } from "next/navigation";

type GuidesPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TripGuidesPage({ params }: GuidesPageProps) {
  const { id: tripId } = await params;
  redirect(`/app/trip/${tripId}?tab=guides`);
}
