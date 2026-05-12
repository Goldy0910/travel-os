import { redirect } from "next/navigation";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const query = (await searchParams) ?? {};
  const trip = query.trip;
  const qs =
    typeof trip === "string" && trip.length > 0 ? `?trip=${encodeURIComponent(trip)}` : "";
  redirect(`/app/home${qs}`);
}
