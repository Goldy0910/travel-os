import { SetAppHeader } from "@/components/AppHeader";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CreateTripForm from "./create-trip-form";

type CreateTripPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateTripPage({ searchParams }: CreateTripPageProps) {
  const params = (await searchParams) ?? {};
  const errorParam = params.error;
  const error =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/app/login");
  }

  return (
    <>
      <SetAppHeader title="Create trip" showBack />
      <main className="min-h-full bg-slate-50 px-4 py-6 pb-[calc(var(--travel-os-bottom-nav-h)+6rem)]">
        <div className="mx-auto w-full max-w-md space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-sm text-slate-500">New Trip</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Create trip</h1>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          <CreateTripForm />
        </div>
        </div>
      </main>
    </>
  );
}
