import { resolveDestination } from "@/app/app/_lib/destination-intel";

/** Infer primary spoken language from destination text (cities & regions). */
export function detectTripLanguage(destination: string): string {
  const intel = resolveDestination(destination);
  const inferredLanguage = intel.language;
  const raw = destination.toLowerCase().trim();
  if (!raw) return "English";
  const d = ` ${raw.replace(/[^\p{L}\p{N}\s,-]/gu, " ").replace(/\s+/g, " ")} `;

  const hasAny = (terms: readonly string[]) => terms.some((term) => d.includes(` ${term} `));

  if (
    hasAny([
      "manali",
      "shimla",
      "dharamshala",
      "kullu",
      "himachal",
      "new delhi",
      "delhi",
      "mumbai",
      "agra",
      "jaipur",
      "goa",
      "varanasi",
      "rishikesh",
      "haridwar",
      "mussoorie",
      "udaipur",
      "jodhpur",
      "amritsar",
      "india",
      "bharat",
    ])
  ) {
    return "Hindi";
  }
  if (hasAny(["tamil nadu", "chennai", "madurai", "coimbatore", "pondicherry"])) return "Tamil";
  if (hasAny(["telangana", "hyderabad", "andhra pradesh", "vijayawada", "visakhapatnam", "vizag"]))
    return "Telugu";
  if (hasAny(["kerala", "kochi", "ernakulam", "thiruvananthapuram", "trivandrum", "kozhikode", "calicut"]))
    return "Malayalam";
  if (hasAny(["karnataka", "bengaluru", "bangalore", "mysuru", "mangalore"])) return "Kannada";
  if (hasAny(["west bengal", "kolkata", "howrah", "darjeeling"])) return "Bengali";
  if (hasAny(["maharashtra", "pune", "nagpur", "nashik"])) return "Marathi";
  if (hasAny(["gujarat", "ahmedabad", "surat", "vadodara", "rajkot"])) return "Gujarati";
  if (hasAny(["punjab", "ludhiana", "jalandhar", "patiala"])) return "Punjabi";
  if (hasAny(["odisha", "orissa", "bhubaneswar", "puri", "cuttack"])) return "Odia";

  if (inferredLanguage && inferredLanguage !== "English") return inferredLanguage;

  if (hasAny(["japan", "tokyo", "osaka", "kyoto", "sapporo", "hokkaido"])) return "Japanese";
  if (hasAny(["france", "paris", "lyon", "nice", "marseille"])) return "French";
  if (hasAny(["spain", "madrid", "barcelona", "seville", "valencia"])) return "Spanish";
  if (hasAny(["germany", "berlin", "munich", "hamburg", "frankfurt"])) return "German";
  if (hasAny(["italy", "rome", "milan", "florence", "venice"])) return "Italian";
  if (hasAny(["china", "beijing", "shanghai", "guangzhou", "shenzhen"])) return "Chinese";
  if (hasAny(["south korea", "korea", "seoul", "busan", "incheon"])) return "Korean";
  if (hasAny(["thailand", "bangkok", "phuket", "chiang mai", "krabi"])) return "Thai";
  if (hasAny(["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah", "qatar", "doha", "saudi", "kuwait", "oman"]))
    return "Arabic";
  if (hasAny(["vietnam", "hanoi", "ho chi minh", "saigon", "da nang"])) return "Vietnamese";
  if (hasAny(["indonesia", "bali", "jakarta", "yogyakarta", "surabaya"])) return "Indonesian";
  if (hasAny(["portugal", "lisbon", "porto", "brazil", "rio de janeiro", "sao paulo"])) return "Portuguese";
  if (hasAny(["russia", "moscow", "saint petersburg"])) return "Russian";
  if (hasAny(["turkey", "istanbul", "ankara", "izmir"])) return "Turkish";
  if (hasAny(["greece", "athens", "santorini", "mykonos"])) return "Greek";
  if (hasAny(["netherlands", "amsterdam", "rotterdam", "the hague"])) return "Dutch";

  return "English";
}
