import { redirect } from "next/navigation";

type ChatPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TripChatPage({ params }: ChatPageProps) {
  const { id: tripId } = await params;
  redirect(`/app/trip/${tripId}?tab=chat`);
}
