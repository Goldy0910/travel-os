import { redirect } from "next/navigation";

type ExpensesPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TripExpensesPage({
  params,
  searchParams,
}: ExpensesPageProps) {
  const { id: tripId } = await params;
  const query = (await searchParams) ?? {};
  const sp = new URLSearchParams();
  sp.set("tab", "expenses");
  const err = query.error;
  if (typeof err === "string" && err.length > 0) sp.set("error", err);
  redirect(`/app/trip/${tripId}?${sp.toString()}`);
}
