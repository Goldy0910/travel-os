import { redirect } from "next/navigation";

type MembersPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TripMembersPage({
  params,
  searchParams,
}: MembersPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const sp = new URLSearchParams();
  sp.set("tab", "members");
  const err = query.error;
  if (typeof err === "string" && err.length > 0) sp.set("error", err);
  redirect(`/app/trip/${tripId}?${sp.toString()}`);
}
