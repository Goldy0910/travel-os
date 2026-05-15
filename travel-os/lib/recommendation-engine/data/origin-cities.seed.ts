export type OriginCity = {
  slug: string;
  name: string;
  region: "north" | "south" | "west" | "east" | "central";
  aliases: string[];
};

/** Common departure cities for Indian travelers. */
export const ORIGIN_CITIES: OriginCity[] = [
  { slug: "mumbai", name: "Mumbai", region: "west", aliases: ["bombay"] },
  { slug: "delhi", name: "Delhi", region: "north", aliases: ["new delhi", "ncr"] },
  { slug: "bangalore", name: "Bangalore", region: "south", aliases: ["bengaluru"] },
  { slug: "hyderabad", name: "Hyderabad", region: "south", aliases: ["telangana"] },
  { slug: "chennai", name: "Chennai", region: "south", aliases: ["madras"] },
  { slug: "kolkata", name: "Kolkata", region: "east", aliases: ["calcutta"] },
  { slug: "pune", name: "Pune", region: "west", aliases: [] },
];

export const DEFAULT_ORIGIN_SLUG = "mumbai";
