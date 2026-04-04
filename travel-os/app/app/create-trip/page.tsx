import BackLink from "@/app/app/_components/back-link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import Link from "next/link";
import { redirect } from "next/navigation";

type CreateTripPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CreateTripPage({
  searchParams,
}: CreateTripPageProps) {
  const params = (await searchParams) ?? {};
  const errorParam = params.error;
  const error =
    typeof errorParam === "string" && errorParam.length > 0
      ? decodeURIComponent(errorParam)
      : "";

  async function createTrip(formData: FormData) {
    "use server";

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/app/login");
    }

    const location = String(formData.get("location") ?? "").trim();
    const startDate = String(formData.get("startDate") ?? "").trim();
    const endDate = String(formData.get("endDate") ?? "").trim();

    if (!location || !startDate || !endDate) {
      redirect("/app/create-trip?error=Please%20fill%20all%20fields");
    }

    if (new Date(endDate) < new Date(startDate)) {
      redirect("/app/create-trip?error=End%20date%20must%20be%20after%20start%20date");
    }

    const { data: newTrip, error: insertError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        location,
        start_date: startDate,
        end_date: endDate,
        title: location,
      })
      .select("id")
      .single();

    if (insertError || !newTrip?.id) {
      redirect(
        `/app/create-trip?error=${encodeURIComponent(
          insertError?.message || "Could not create trip",
        )}`,
      );
    }

    const tripId = String(newTrip.id);
    const organizerName =
      (typeof user.user_metadata?.full_name === "string" &&
        user.user_metadata.full_name.trim()) ||
      (user.email?.split("@")[0] ?? "Organizer");

    const { error: memberError } = await supabase.from("members").insert({
      trip_id: tripId,
      user_id: user.id,
      name: organizerName,
      email: user.email ?? "",
      role: "organizer",
    });

    if (memberError) {
      await supabase.from("trips").delete().eq("id", tripId);
      redirect(
        `/app/create-trip?error=${encodeURIComponent(
          memberError.message || "Could not set up trip membership",
        )}`,
      );
    }

    redirect("/app/trips");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-28">
      <div className="mx-auto w-full max-w-md space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink href="/app/trips">Back to trips</BackLink>
          <BackLink href="/app/home">Home</BackLink>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-sm text-slate-500">New Trip</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Create trip
            </h1>
          </div>

          {error ? (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <form action={createTrip} className="space-y-4">
            <div>
              <label
                htmlFor="location"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Location
              </label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="Tokyo"
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="startDate"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div>
              <label
                htmlFor="endDate"
                className="mb-1 block text-sm font-medium text-slate-700"
              >
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div className="pt-2 text-sm">
              <Link href="/app/trips" className="text-slate-500 underline">
                Cancel
              </Link>
            </div>

            <button
              type="submit"
              className="fixed bottom-20 left-4 right-4 mx-auto h-12 w-[calc(100%-2rem)] max-w-md rounded-xl bg-slate-900 text-base font-medium text-white shadow-lg transition hover:bg-slate-800"
            >
              Save trip
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
