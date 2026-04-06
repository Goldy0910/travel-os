import PageLoader from "@/components/ui/page-loader";

export default function JoinLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <PageLoader message="Joining trip…" className="min-h-screen flex-1" />
    </main>
  );
}
