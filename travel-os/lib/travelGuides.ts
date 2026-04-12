/**
 * Curated YouTube travel guides by destination (beta / hardcoded).
 * Keys are lowercase place slugs matched against trip location text.
 */

export type TravelGuideVideo = {
  title: string;
  youtubeId: string;
};

export type TravelGuideLink = {
  title: string;
  url: string;
};

export type TravelGuideEssentials = {
  weather: string;
  language: string;
  currency: string;
  fashion: string;
  tips: string[];
};

export type TravelGuideMoney = {
  atm: string;
  exchange: string;
  tips: string[];
};

export type TravelGuidesBundle = {
  places: TravelGuideVideo[];
  food: TravelGuideVideo[];
  essentials: TravelGuideEssentials;
  transport: string[];
  money: TravelGuideMoney;
  links: TravelGuideLink[];
};

export const travelGuides: Record<string, TravelGuidesBundle> = {
  goa: {
    places: [
      {
        title: "Top Places to Visit in Goa",
        youtubeId: "jSTNtS76U14",
      },
      {
        title: "North Goa vs South Goa explained",
        youtubeId: "ysz5S6PUM-U",
      },
    ],
    food: [
      {
        title: "Must-try Goan food",
        youtubeId: "rfscVS0vtbw",
      },
      {
        title: "Best seafood spots in Goa",
        youtubeId: "n3D-TlXMD-g",
      },
    ],
    essentials: {
      weather:
        "Best months are Nov-Feb. Summers are humid; carry sunscreen and hydrate often.",
      language: "Konkani, Marathi, and English are commonly used in tourist zones.",
      currency: "Indian Rupee (INR). UPI is widely accepted in most cafes and shops.",
      fashion: "Light cottons, sandals, and modest cover-ups for churches/temples.",
      tips: [
        "Keep a light rain layer in monsoon months.",
        "Book beach stays early on long weekends.",
      ],
    },
    transport: [
      "Scooter rentals are common for short local travel.",
      "Use app cabs for airport and late-night transfers.",
      "Pre-book intercity buses during peak season.",
    ],
    money: {
      atm: "ATMs are easy to find in Panaji, Calangute, and Margao.",
      exchange: "Exchange at airports or city centers; compare rates before converting cash.",
      tips: [
        "Carry some cash for beach shacks and small vendors.",
        "Prefer UPI/card where available for easier spend tracking.",
      ],
    },
    links: [
      { title: "Goa Tourism", url: "https://www.goa-tourism.com/" },
      { title: "Indian Railways", url: "https://www.irctc.co.in/" },
      { title: "Airport Info (GOI)", url: "https://www.aai.aero/en/airports/goa-dabolim" },
    ],
  },
  tokyo: {
    places: [
      { title: "Top 10 Places to Visit in Tokyo", youtubeId: "RiJhQkvlCok" },
      { title: "How to Spend 3 Days in Tokyo", youtubeId: "Z2PVlWgJnjo" },
    ],
    food: [
      { title: "TOKYO Food Guide | 40 Places to Eat & Drink (With Prices!)", youtubeId: "RY1CAaGslyc" },
      { title: "10 Foods YOU MUST Try in Japan: Food and Travel Guide", youtubeId: "CcZaE8pn8nc" },
    ],
    essentials: {
      weather:
        "Spring and autumn are pleasant. Summers are hot/humid; winters are dry and cold.",
      language: "Japanese is primary; major stations include English signage.",
      currency: "Japanese Yen (JPY). Cards are common, but cash still matters in some places.",
      fashion: "Smart-casual layers and comfortable walking shoes are ideal.",
      tips: [
        "Carry a small bag for daily trash and essentials.",
        "Stay near a JR/Metro line for easy commuting.",
      ],
    },
    transport: [
      "Get an IC card (Suica/PASMO) for trains and buses.",
      "Use station exits carefully; large stations have many gates.",
      "Airport express trains are often faster than taxis.",
    ],
    money: {
      atm: "Convenience stores (7-Eleven/FamilyMart/Lawson) usually support foreign cards.",
      exchange: "Airport exchanges are convenient; city counters may offer better rates.",
      tips: [
        "Keep coins for vending machines and lockers.",
        "Some smaller restaurants are cash-only.",
      ],
    },
    links: [
      { title: "Japan Travel", url: "https://www.japan.travel/en/" },
      { title: "Tokyo Metro", url: "https://www.tokyometro.jp/en/" },
      { title: "JR East", url: "https://www.jreast.co.jp/e/" },
    ],
  },
  delhi: {
    places: [
      { title: "Old Delhi heritage walk", youtubeId: "rfscVS0vtbw" },
      { title: "Monuments you should not miss", youtubeId: "ysz5S6PUM-U" },
    ],
    food: [
      { title: "Chandni Chowk food trail", youtubeId: "jSTNtS76U14" },
    ],
    essentials: {
      weather:
        "Winters can be chilly; summers are very hot. Plan hydration and shade in daytime.",
      language: "Hindi and English are widely understood in city areas.",
      currency: "Indian Rupee (INR). Digital payments are common across the city.",
      fashion: "Light breathable outfits + comfortable shoes for markets/heritage walks.",
      tips: [
        "Start outdoor visits early to avoid heat and traffic.",
        "Prefer bottled water when moving around all day.",
      ],
    },
    transport: [
      "Delhi Metro is fast and reliable for major routes.",
      "Use app cabs for point-to-point convenience.",
      "Plan buffer time for peak-hour road traffic.",
    ],
    money: {
      atm: "ATMs are widely available in metro stations and market areas.",
      exchange: "Use airport or authorized exchange counters; avoid unverified street exchanges.",
      tips: [
        "Keep small notes for local market purchases.",
        "Track spending in-app for group settlements.",
      ],
    },
    links: [
      { title: "Delhi Tourism", url: "https://delhitourism.gov.in/" },
      { title: "Delhi Metro Rail", url: "https://www.delhimetrorail.com/" },
      { title: "Airport Info (DEL)", url: "https://www.newdelhiairport.in/" },
    ],
  },
  manali: {
    places: [
      { title: "Top 10 Best Tourist Places to Visit in Manali", youtubeId: "pRRRcmXKUiE" },
      { title: "Manali full tour in telugu", youtubeId: "SPNA6tQM7go" },
      { title: "Manali Budget Tour Plan In Telugu", youtubeId: "McqrQtt6_V8" },
    ],
    food: [
      { title: "Best Street Food of Manali Mall Road | Old Manali", youtubeId: "uhHb65agJY0" },
      { title: "Trying Manali Street Food for 24 Hours", youtubeId: "kRPYJ1gGqM0" },
    ],
    essentials: {
      weather:
        "Days can be pleasant but evenings are cold. Carry warm layers year-round.",
      language: "Hindi and English are commonly understood in tourist areas.",
      currency: "Indian Rupee (INR). UPI works in many places; keep backup cash.",
      fashion:
        "Layered clothing, waterproof jacket, and grippy shoes for mountain terrain.",
      tips: [
        "Start day trips early to avoid traffic on mountain roads.",
        "Keep medicine for motion sickness if driving to high-altitude spots.",
      ],
    },
    transport: [
      "Volvo buses from Delhi/Chandigarh are common for intercity travel.",
      "Local taxis are best for Solang, Atal Tunnel, and nearby villages.",
      "Road conditions can change quickly in monsoon/winter; check before leaving.",
    ],
    money: {
      atm: "ATMs are available in central Manali but may have limited cash in peak season.",
      exchange: "For foreign currency, exchange in major cities before reaching Manali.",
      tips: [
        "Carry small notes for cafes and local shops in remote spots.",
        "Network can be patchy in some valleys; keep offline payment backup.",
      ],
    },
    links: [
      { title: "Himachal Tourism", url: "https://himachaltourism.gov.in/" },
      { title: "Manali Weather Forecast", url: "https://www.accuweather.com/en/in/manali/188511/weather-forecast/188511" },
      { title: "HRTC Bus Booking", url: "https://online.hrtchp.com/" },
    ],
  },
  mussoorie: {
    places: [
      { title: "Watch This Guide Before Visiting Mussoorie", youtubeId: "4yPf1jVZ-dQ&t=19s" },
      { title: "Mussoorie full video Telugu", youtubeId: "yGjqFRGPVO8" },
      { title: "Mussoorie Tourist Places", youtubeId: "yFB3NxgpnMY" },
    ],
    food: [
      { title: "Mussoorie Mall Road Food Tour", youtubeId: "0E8OETCGe4A" },
      { title: "76 Yr Old Restaurant in Mussoorie", youtubeId: "PLCYXYLVQBekLOIhZB6yS0mAxhx5uJFt4Y" },
    ],
    essentials: {
      weather:
        "Pleasant in summers (15–25°C), cold in winters (can drop below 5°C). Evenings are cool year-round. Monsoons bring heavy rain and fog—visibility can drop significantly.",
      language:
        "Hindi is widely spoken. English is well understood in hotels, cafes, and tourist areas.",
      currency:
        "Indian Rupee (INR). UPI works in most places on Mall Road, but carry cash for small shops and remote spots like Landour.",
      fashion:
        "Layered clothing is ideal. Light woolens in summer evenings, heavy jackets in winter, and waterproof gear during monsoon. Comfortable walking shoes are a must due to slopes.",
      tips: [
        "Only local vehicles are allowed inside Mall Road. Bike rentals and cabs are not allowed.",
        "Mall Road gets extremely crowded in evenings—visit early morning or late night for a better experience.",
        "Avoid driving inside Mall Road during peak hours; parking is limited and restricted.",
        "Start early for places like Kempty Falls to avoid traffic and crowds.",
        "Fog can disrupt views suddenly—keep buffer time in your itinerary.",
        "Book hotels with parking if you’re driving; not all properties have it.",
      ],
    },
    
    transport: [
      "Nearest railhead is  (~35 km). Taxis are easily available from there.",
      "Nearest airport is  (~60 km).",
      "Regular buses (including Volvo) run from Delhi to Dehradun; from there take taxi/shared cab to Mussoorie.",
      "Local transport mainly consists of taxis; autos are limited.",
      "Walking is the best way to explore areas like  and .",
      "Roads are narrow and steep—self-driving can be tricky during peak season or rains.",
    ],
    
    money: {
      atm:
        "ATMs are available around Mall Road and Library Chowk but may run out of cash during peak tourist seasons.",
      exchange:
        "Foreign currency exchange options are very limited—better to exchange in Delhi or Dehradun.",
      tips: [
        "Carry small cash for street food, local taxis, and entry tickets.",
        "UPI works well in main areas but network issues can occur in Landour or outskirts.",
        "Some cafes in Landour may prefer cash or have minimum card limits.",
      ],
    },
    
    links: [
      {
        title: "Uttarakhand Tourism",
        url: "https://uttarakhandtourism.gov.in/",
      },
      {
        title: "Mussoorie Weather Forecast",
        url: "https://www.accuweather.com/en/in/mussoorie/189187/weather-forecast/189187",
      },
      {
        title: "UTC Bus Services",
        url: "https://utconline.uk.gov.in/",
      },
    ],
  },
};

const GUIDE_KEYS = Object.keys(travelGuides);

/** Normalize user-facing place string for lookup (lowercase, alnum only). */
export function normalizePlaceKey(place: string): string {
  return place.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Match trip.place / location against curated guide keys.
 * Tries compact slug, substring match, and first word of the place name.
 */
export function resolvePlaceGuideKey(place: string): string | null {
  const raw = place.trim().toLowerCase();
  if (!raw) return null;

  const compact = normalizePlaceKey(place);
  if (compact && travelGuides[compact]) return compact;

  for (const key of GUIDE_KEYS) {
    if (compact.includes(key) || raw.includes(key)) return key;
  }

  const firstToken = raw.split(/[\s,|/]+/).find((t) => t.length >= 3);
  if (firstToken) {
    const tokenKey = firstToken.replace(/[^a-z0-9]/g, "");
    if (tokenKey && travelGuides[tokenKey]) return tokenKey;
    for (const key of GUIDE_KEYS) {
      if (tokenKey.includes(key) || key.includes(tokenKey)) return key;
    }
  }

  return null;
}

export function getTravelGuidesForPlace(place: string): TravelGuidesBundle | null {
  const key = resolvePlaceGuideKey(place);
  if (!key) return null;
  return travelGuides[key] ?? null;
}

export function bundleHasVideos(bundle: TravelGuidesBundle): boolean {
  return (
    bundle.places.length > 0 ||
    bundle.food.length > 0 ||
    bundle.transport.length > 0 ||
    bundle.links.length > 0 ||
    bundle.essentials.tips.length > 0 ||
    bundle.essentials.weather.trim().length > 0 ||
    bundle.essentials.language.trim().length > 0 ||
    bundle.essentials.currency.trim().length > 0 ||
    bundle.essentials.fashion.trim().length > 0 ||
    bundle.money.atm.trim().length > 0 ||
    bundle.money.exchange.trim().length > 0 ||
    bundle.money.tips.length > 0
  );
}

export const GUIDE_CATEGORIES = [
  { id: "places" as const, label: "Places" },
  { id: "food" as const, label: "Food" },
  { id: "essentials" as const, label: "Essentials" },
  { id: "transport" as const, label: "Transport" },
  { id: "money" as const, label: "Money" },
  { id: "links" as const, label: "Links" },
];

export type GuideCategoryId = (typeof GUIDE_CATEGORIES)[number]["id"];
