import { redirect } from "next/navigation";

type DocsPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TripDocsPage({ params, searchParams }: DocsPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const sp = new URLSearchParams();
  sp.set("tab", "docs");
  const success = query.success;
  if (typeof success === "string" && success.length > 0) sp.set("success", success);
  const err = query.error;
  if (typeof err === "string" && err.length > 0) sp.set("error", err);
  redirect(`/app/trip/${tripId}?${sp.toString()}`);
}
