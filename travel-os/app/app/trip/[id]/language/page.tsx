import { createServerClient as createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isTripMember } from "@/lib/trip-membership";

import LanguageClient from "./_components/LanguageClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function TripLanguagePage({ params }: Props) {
  const { id } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerComponentClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can be read-only for cookies.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const member = await isTripMember(supabase, id, user.id);
  if (!member) redirect("/app");

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id,title,destination,place")
    .eq("id", id)
    .maybeSingle();

  if (error || !trip) redirect("/app");

  const destination = (trip.place as string | null) || trip.destination || "";
  const title = typeof trip.title === "string" && trip.title.trim() ? trip.title.trim() : "Trip";

  return (
    <LanguageClient tripId={trip.id} tripTitle={title} destination={destination} />
  );
}
