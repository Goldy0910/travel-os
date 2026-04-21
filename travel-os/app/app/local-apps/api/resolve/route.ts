import { NextRequest, NextResponse } from "next/server";
import { resolveDestination } from "@/app/app/_lib/destination-intel";
import { LOCAL_APPS_DATA } from "@/app/app/local-apps/_lib/city-apps-data";
import { resolveCityApps, resolveLocalAppsDataKey } from "@/app/app/local-apps/_lib/local-apps-helpers";
import type { LocalCityApps } from "@/app/app/local-apps/_lib/types";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function normalizeText(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesTerm(haystack: string, term: string): boolean {
  return ` ${haystack} `.includes(` ${term} `);
}

function looksLikeCityApps(value: unknown): value is LocalCityApps {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<LocalCityApps>;
  return (
    typeof v.city === "string" &&
    typeof v.country === "string" &&
    Array.isArray(v.mustHave) &&
    !!v.categories &&
    typeof v.categories === "object" &&
    typeof v.lastUpdatedIso === "string"
  );
}

export async function GET(req: NextRequest) {
  const destination = String(req.nextUrl.searchParams.get("destination") ?? "").trim();
  if (!destination) {
    return NextResponse.json({ ok: false, error: "Missing destination." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const intel = resolveDestination(destination);
  const normalizedDestination = normalizeText(intel.normalized || destination);
  const candidateAliases = Array.from(
    new Set(
      [normalizedDestination, normalizeText(intel.city), normalizeText(intel.country)].filter((v) => v.length > 0),
    ),
  );

  let profileKey = "";

  if (candidateAliases.length > 0) {
    const { data: directAliases } = await supabase
      .from("local_apps_aliases")
      .select("alias, profile_key")
      .in("alias", candidateAliases);
    if (directAliases && directAliases.length > 0) {
      const exact = directAliases.find((row) => candidateAliases.includes(String(row.alias ?? "")));
      profileKey = String(exact?.profile_key ?? "");
    }
  }

  if (!profileKey) {
    const { data: allAliases } = await supabase
      .from("local_apps_aliases")
      .select("alias, profile_key");
    if (allAliases && allAliases.length > 0) {
      const ranked = allAliases
        .map((row) => ({
          alias: normalizeText(String(row.alias ?? "")),
          profileKey: String(row.profile_key ?? ""),
        }))
        .filter((row) => row.alias.length > 0 && row.profileKey.length > 0)
        .sort((a, b) => b.alias.length - a.alias.length);
      const match = ranked.find((row) => includesTerm(normalizedDestination, row.alias));
      if (match) profileKey = match.profileKey;
    }
  }

  if (profileKey) {
    const { data: profile } = await supabase
      .from("local_apps_profiles")
      .select("payload")
      .eq("profile_key", profileKey)
      .maybeSingle();
    if (looksLikeCityApps(profile?.payload)) {
      return NextResponse.json({ ok: true, data: profile.payload, source: "db" });
    }

    const staticProfile = LOCAL_APPS_DATA[profileKey];
    if (staticProfile) {
      return NextResponse.json({ ok: true, data: staticProfile, source: "seed" });
    }
  }

  const fallbackKey = resolveLocalAppsDataKey(destination);
  const fallback = LOCAL_APPS_DATA[fallbackKey] ?? resolveCityApps(destination);
  return NextResponse.json({ ok: true, data: fallback, source: "fallback" });
}

