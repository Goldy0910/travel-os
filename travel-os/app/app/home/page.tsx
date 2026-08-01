import StandaloneChatShell from "@/app/app/chat/_components/standalone-chat-shell";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** App landing: standalone AI chat. Create-trip CTA appears when destination + dates are ready. */
export default async function HomePage({ searchParams }: HomePageProps) {
  return (
    <StandaloneChatShell
      searchParams={searchParams}
      headerTitle="Travel Till 99"
      showBack={false}
    />
  );
}
