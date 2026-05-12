import TripCommandCenter from "@/app/app/_components/trip-command-center";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  return <TripCommandCenter searchParams={searchParams} />;
}
