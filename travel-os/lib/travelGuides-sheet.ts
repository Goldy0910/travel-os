import "server-only";

import {
  getTravelGuidesForPlace,
  normalizePlaceKey,
  resolvePlaceGuideKey,
  travelGuides,
  type TravelGuideEssentials,
  type TravelGuideLink,
  type TravelGuideMoney,
  type TravelGuideVideo,
  type TravelGuidesBundle,
} from "@/lib/travelGuides";
import { resolveDestination } from "@/app/app/_lib/destination-intel";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { unstable_cache } from "next/cache";

type GuideVideoCategory = "places" | "food";
type SheetVideosByPlace = Record<string, Record<GuideVideoCategory, TravelGuideVideo[]>>;
type CsvTarget = { url: string; gid: string | null };

type GuideCountryPreset = {
  essentials: TravelGuideEssentials;
  transport: string[];
  money: TravelGuideMoney;
  links: TravelGuideLink[];
};

const INDIA_LINKS: TravelGuideLink[] = [
  { title: "Incredible India", url: "https://www.incredibleindia.org/" },
  { title: "Indian Railways", url: "https://www.irctc.co.in/" },
  { title: "AAI Airports", url: "https://www.aai.aero/en/airports" },
];

const COUNTRY_PRESETS: Record<string, GuideCountryPreset> = {
  India: {
    essentials: {
      weather: "Weather varies by region and altitude. Check city forecast before intercity travel.",
      language: "Hindi and English are widely understood in major travel hubs.",
      currency: "Indian Rupee (INR). UPI and cards are common in cities; carry some cash.",
      fashion: "Light breathable layers for day travel; carry modest wear for temples and heritage sites.",
      tips: [
        "Start sightseeing early to avoid traffic and midday heat.",
        "Carry small notes for local transport and small vendors.",
      ],
    },
    transport: [
      "Use app cabs/metro in major cities for predictable travel.",
      "For intercity routes, pre-book trains or buses during peak dates.",
      "Keep extra buffer for road traffic and weather-related delays.",
    ],
    money: {
      atm: "ATMs are widely available in cities and tourist districts.",
      exchange: "Exchange at airports/banks/authorized counters; compare rates first.",
      tips: [
        "UPI is convenient where available.",
        "Keep backup cash for remote areas and local markets.",
      ],
    },
    links: INDIA_LINKS,
  },
  Japan: {
    essentials: {
      weather: "Spring and autumn are pleasant; summers are humid and winters can be cold.",
      language: "Japanese is primary; English signage is common in major transit hubs.",
      currency: "Japanese Yen (JPY). Cards are common, but cash is still useful in smaller shops.",
      fashion: "Smart-casual layers and comfortable walking shoes are ideal.",
      tips: [
        "Stay near a major rail/metro line for easier daily movement.",
        "Carry a compact day bag for essentials and purchases.",
      ],
    },
    transport: [
      "Use IC cards and route-planner apps for faster station transfers.",
      "Airport express trains are usually faster than taxis.",
      "Double-check station exits in large interchanges.",
    ],
    money: {
      atm: "Convenience-store ATMs typically support international cards.",
      exchange: "Airport exchanges are convenient; city counters may have better rates.",
      tips: [
        "Carry coins for lockers and vending machines.",
        "Some smaller eateries may be cash-only.",
      ],
    },
    links: [
      { title: "Japan Travel", url: "https://www.japan.travel/en/" },
      { title: "JR East", url: "https://www.jreast.co.jp/e/" },
      { title: "Tokyo Metro", url: "https://www.tokyometro.jp/en/" },
    ],
  },
  Thailand: {
    essentials: {
      weather: "Warm year-round; monsoon months can bring heavy rain in short bursts.",
      language: "Thai is primary; English is common in major tourist zones.",
      currency: "Thai Baht (THB). Cards work in malls/hotels, but cash is essential in markets.",
      fashion: "Light clothing, breathable footwear, and modest attire for temples.",
      tips: [
        "Download offline maps before island or remote transfers.",
        "Carry small cash for street food and local rides.",
      ],
    },
    transport: [
      "Use ride-hailing apps in major cities for transparent fares.",
      "For islands, confirm ferry schedules in advance.",
      "Avoid peak-hour road transfers where possible.",
    ],
    money: {
      atm: "ATMs are easy to find in city/tourist areas.",
      exchange: "Airport rates are convenient; city booths may be better.",
      tips: [
        "Keep low-denomination notes for markets.",
        "Use cards for larger spends where accepted.",
      ],
    },
    links: [
      { title: "Tourism Thailand", url: "https://www.tourismthailand.org/" },
      { title: "State Railway of Thailand", url: "https://www.railway.co.th/" },
      { title: "AOT Airports", url: "https://www.airportthai.co.th/en/" },
    ],
  },
  Singapore: {
    essentials: {
      weather: "Hot and humid year-round with occasional showers.",
      language: "English is widely used across transport and services.",
      currency: "Singapore Dollar (SGD). Cards and contactless payments are widely accepted.",
      fashion: "Light clothing with a small umbrella for sudden rain.",
      tips: [
        "Use transit apps to optimize MRT + bus connections.",
        "Carry a light layer for cold indoor AC environments.",
      ],
    },
    transport: [
      "MRT and buses are fast, reliable, and well-connected.",
      "Use contactless cards or SimplyGo-compatible options.",
      "Walkability is high for downtown attractions.",
    ],
    money: {
      atm: "ATMs are common in malls, MRT-linked centers, and neighborhoods.",
      exchange: "Official money changers are widespread in central districts.",
      tips: [
        "Contactless cards usually work everywhere.",
        "Keep small cash for select hawker/market stalls.",
      ],
    },
    links: [
      { title: "Visit Singapore", url: "https://www.visitsingapore.com/" },
      { title: "LTA", url: "https://www.lta.gov.sg/" },
      { title: "Changi Airport", url: "https://www.changiairport.com/" },
    ],
  },
  Maldives: {
    essentials: {
      weather: "Tropical climate year-round; wetter monsoon periods vary by season.",
      language: "Dhivehi is local; English is common in resorts and tourist services.",
      currency: "MVR and USD are both common in many tourist contexts.",
      fashion: "Resort casuals, reef-safe sun protection, and lightweight layers.",
      tips: [
        "Coordinate transfers with your accommodation in advance.",
        "Keep printed/online booking confirmations for boat/seaplane timing.",
      ],
    },
    transport: [
      "Inter-island movement is mostly by speedboat or seaplane.",
      "Transfer timings can be weather dependent.",
      "Confirm final-leg transfer windows before booking flights.",
    ],
    money: {
      atm: "ATMs are more available in city islands than resort islands.",
      exchange: "Exchange in arrival points or carry mixed payment options.",
      tips: [
        "Carry cash for local-island shops and small purchases.",
        "Cards are common in resort properties.",
      ],
    },
    links: [
      { title: "Visit Maldives", url: "https://visitmaldives.com/" },
      { title: "Maldives Airports", url: "https://www.macl.aero/" },
      { title: "Maldives Immigration", url: "https://imuga.immigration.gov.mv/" },
    ],
  },
  Malaysia: {
    essentials: {
      weather: "Tropical climate with warm temperatures and seasonal rain.",
      language: "Malay is national language; English is common in major cities.",
      currency: "Malaysian Ringgit (MYR). Cards and e-wallets are common in urban areas.",
      fashion: "Light breathable outfits with a compact rain layer.",
      tips: [
        "Use cash for small-town stalls and local markets.",
        "Plan around peak-hour traffic in major cities.",
      ],
    },
    transport: [
      "Ride-hailing is convenient across major cities.",
      "Urban rail is useful in Kuala Lumpur.",
      "Intercity buses/trains are good value when pre-booked.",
    ],
    money: {
      atm: "ATMs are widely available in malls and transit hubs.",
      exchange: "Authorized city exchange counters often offer better rates than airports.",
      tips: [
        "Keep some cash for tolls/independent shops.",
        "Tap-to-pay works broadly in large cities.",
      ],
    },
    links: [
      { title: "Tourism Malaysia", url: "https://www.malaysia.travel/" },
      { title: "KTM Berhad", url: "https://www.ktmb.com.my/" },
      { title: "Malaysia Airports", url: "https://www.malaysiaairports.com.my/" },
    ],
  },
  "Sri Lanka": {
    essentials: {
      weather: "Climate varies by coast and hills; rain seasons differ by region.",
      language: "Sinhala and Tamil are primary; English is common in tourist zones.",
      currency: "Sri Lankan Rupee (LKR). Cards are common in cities; cash helps outside metros.",
      fashion: "Light clothing plus a layer for hill-country evenings.",
      tips: [
        "Plan extra travel time for scenic hill routes.",
        "Keep offline maps for rural stretches.",
      ],
    },
    transport: [
      "Use local app cabs in larger cities where available.",
      "Scenic train routes are popular; book early.",
      "Road travel can be slower than map estimates.",
    ],
    money: {
      atm: "ATMs are available in most city/town centers.",
      exchange: "Use banks/authorized counters for safer rates.",
      tips: [
        "Carry cash for smaller towns and local eateries.",
        "Keep smaller denominations handy for short rides.",
      ],
    },
    links: [
      { title: "Sri Lanka Tourism", url: "https://www.srilanka.travel/" },
      { title: "Sri Lanka Railways", url: "https://eservices.railway.gov.lk/" },
      { title: "Airport & Aviation Sri Lanka", url: "https://airport.lk/" },
    ],
  },
  Indonesia: {
    essentials: {
      weather: "Tropical weather; expect humidity and periodic rain.",
      language: "Bahasa Indonesia is primary; English common in major tourist areas.",
      currency: "Indonesian Rupiah (IDR). Cards and e-wallets are common in cities.",
      fashion: "Light fabrics, sun/rain protection, and comfortable sandals/shoes.",
      tips: [
        "Use motorbike ride options to beat city traffic where safe.",
        "Download offline maps for island and rural travel.",
      ],
    },
    transport: [
      "Ride-hailing apps are standard in major cities and Bali.",
      "Domestic flights are common for long inter-island routes.",
      "Allow extra transfer time in high-traffic zones.",
    ],
    money: {
      atm: "ATMs are common in urban and tourist centers.",
      exchange: "Use established exchange counters and verify rates/fees.",
      tips: [
        "Cash remains useful for markets and local stalls.",
        "Keep smaller denominations for short-distance spending.",
      ],
    },
    links: [
      { title: "Indonesia Travel", url: "https://www.indonesia.travel/" },
      { title: "KAI Access", url: "https://www.kai.id/" },
      { title: "Angkasa Pura Airports", url: "https://www.angkasapura2.co.id/" },
    ],
  },
  Nepal: {
    essentials: {
      weather: "Conditions vary by altitude; mornings/evenings can be cooler.",
      language: "Nepali is primary; English is common in trekking and tourist hubs.",
      currency: "Nepalese Rupee (NPR). Cash is still essential in many places.",
      fashion: "Layered clothing and sturdy footwear for uneven terrain.",
      tips: [
        "Keep offline maps for mountain and trail regions.",
        "Carry small denominations for local transport and permits.",
      ],
    },
    transport: [
      "In-city ride options are available in major urban areas.",
      "Mountain routes can take longer than expected; start early.",
      "Domestic flights are weather-sensitive in some regions.",
    ],
    money: {
      atm: "ATMs are available in major city/tourist centers.",
      exchange: "Exchange at banks/authorized dealers for safer transactions.",
      tips: [
        "Cash is preferred for many local purchases.",
        "Keep backup funds for network/ATM downtime.",
      ],
    },
    links: [
      { title: "Nepal Tourism Board", url: "https://ntb.gov.np/" },
      { title: "Nepal Airlines", url: "https://www.nepalairlines.com.np/" },
      { title: "TIA Airport", url: "https://tiairport.com.np/" },
    ],
  },
  Vietnam: {
    essentials: {
      weather: "Weather differs north-to-south; check regional forecast before travel.",
      language: "Vietnamese is primary; English is common in tourism-focused districts.",
      currency: "Vietnamese Dong (VND). Cash and QR payments are both widely used in cities.",
      fashion: "Lightweight outfits with rain-ready layers in wet months.",
      tips: [
        "Use offline maps in alley-heavy neighborhoods.",
        "Carry smaller cash notes for markets and local eateries.",
      ],
    },
    transport: [
      "Ride-hailing (car/bike) is common and affordable in major cities.",
      "Domestic flights help cover long distances efficiently.",
      "Plan extra time for peak-hour scooter traffic.",
    ],
    money: {
      atm: "ATMs are frequent in major urban areas.",
      exchange: "Airport counters are convenient; city exchanges may offer better rates.",
      tips: [
        "Keep a mix of cash and digital payment options.",
        "Double-check denominations before paying in crowded areas.",
      ],
    },
    links: [
      { title: "Vietnam Tourism", url: "https://vietnam.travel/" },
      { title: "Vietnam Railways", url: "https://dsvn.vn/" },
      { title: "Vietnam Airports", url: "https://vietnamairport.vn/" },
    ],
  },
  Turkey: {
    essentials: {
      weather: "Coastal and inland climates differ; pack layers for seasonal swings.",
      language: "Turkish is primary; English is common in major tourist districts.",
      currency: "Turkish Lira (TRY). Cards are common in cities; cash helps in bazaars/local spots.",
      fashion: "Comfortable walking footwear; modest options for mosques/religious sites.",
      tips: [
        "Carry a light scarf for religious-site etiquette.",
        "Download offline maps for older city quarters.",
      ],
    },
    transport: [
      "Use app taxis in large cities for clearer fare expectations.",
      "Intercity buses and flights are efficient for long routes.",
      "Historic centers may be best explored on foot.",
    ],
    money: {
      atm: "ATMs are common across city centers and tourist areas.",
      exchange: "Use authorized exchange counters and compare spreads.",
      tips: [
        "Keep cash for markets and small cafes.",
        "Track transport and dining spend daily for budgeting.",
      ],
    },
    links: [
      { title: "Go Türkiye", url: "https://goturkiye.com/" },
      { title: "TCDD Transport", url: "https://www.tcddtasimacilik.gov.tr/" },
      { title: "Istanbul Airport", url: "https://www.istairport.com/en/" },
    ],
  },
  Switzerland: {
    essentials: {
      weather: "Mountain weather changes quickly; layers are essential year-round.",
      language: "German/French/Italian vary by region; English is common in tourism.",
      currency: "Swiss Franc (CHF). Cards are widely accepted.",
      fashion: "Layered weatherproof clothing and supportive footwear.",
      tips: [
        "Check weather and elevation before alpine day trips.",
        "Book panoramic trains and peak routes in advance.",
      ],
    },
    transport: [
      "Rail and local transit are reliable and punctual.",
      "Use national rail apps for live platform and transfer updates.",
      "Mountain transport can be weather-dependent in shoulder seasons.",
    ],
    money: {
      atm: "ATMs are easy to find in cities and station hubs.",
      exchange: "Exchange at airports/banks as needed; cards usually suffice.",
      tips: [
        "Budget for higher costs in major cities and resorts.",
        "Use passes where available for better rail value.",
      ],
    },
    links: [
      { title: "Switzerland Tourism", url: "https://www.myswitzerland.com/" },
      { title: "SBB", url: "https://www.sbb.ch/en/" },
      { title: "Zurich Airport", url: "https://www.flughafen-zuerich.ch/en" },
    ],
  },
  France: {
    essentials: {
      weather: "Spring/autumn are comfortable; summer can be warm and busy.",
      language: "French is primary; English is common in major tourist zones.",
      currency: "Euro (EUR). Card usage is widespread.",
      fashion: "City-smart casual wear with comfortable walking shoes.",
      tips: [
        "Reserve major museum/landmark slots in advance.",
        "Keep a light layer for evening temperature drops.",
      ],
    },
    transport: [
      "Metro/tram systems are efficient in major cities.",
      "Intercity rail is excellent for city-to-city travel.",
      "Validate local transit tickets where required.",
    ],
    money: {
      atm: "ATMs are common in city centers and transit nodes.",
      exchange: "Within Eurozone travel, cards usually reduce exchange needs.",
      tips: [
        "Keep small cash for local markets and kiosks.",
        "Tap-to-pay is widely available.",
      ],
    },
    links: [
      { title: "France.fr", url: "https://www.france.fr/en" },
      { title: "SNCF Connect", url: "https://www.sncf-connect.com/en-en/" },
      { title: "Paris Aéroport", url: "https://www.parisaeroport.fr/en" },
    ],
  },
  Italy: {
    essentials: {
      weather: "Climate varies by region; summers can be hot in inland cities.",
      language: "Italian is primary; English is common in tourist areas.",
      currency: "Euro (EUR). Cards are common; cash still helps in smaller outlets.",
      fashion: "Comfortable shoes for cobblestone streets and long walks.",
      tips: [
        "Book timed tickets for major attractions in peak season.",
        "Carry water and light layers during summer sightseeing.",
      ],
    },
    transport: [
      "Regional and high-speed trains connect major cities well.",
      "Historic centers often favor walking over driving.",
      "Validate paper tickets where required before boarding.",
    ],
    money: {
      atm: "ATMs are readily available in city centers.",
      exchange: "Cards are convenient; keep some euro cash for small vendors.",
      tips: [
        "Watch for city tourist taxes at accommodation.",
        "Track cash spend at markets and small cafes.",
      ],
    },
    links: [
      { title: "Italia.it", url: "https://www.italia.it/en" },
      { title: "Trenitalia", url: "https://www.trenitalia.com/en.html" },
      { title: "Aeroporti di Roma", url: "https://www.adr.it/web/aeroporti-di-roma-en/" },
    ],
  },
  "United Kingdom": {
    essentials: {
      weather: "Weather can shift quickly; rain-ready layers are useful year-round.",
      language: "English is primary.",
      currency: "British Pound (GBP). Contactless payments are common.",
      fashion: "Layered casual wear with a compact rain jacket/umbrella.",
      tips: [
        "Use transit apps for live service updates.",
        "Reserve intercity rail early for better fares.",
      ],
    },
    transport: [
      "Urban rail/bus systems are extensive in major cities.",
      "Contactless bank cards often work directly on transit gates.",
      "Intercity trains are fast; advance booking helps with pricing.",
    ],
    money: {
      atm: "ATMs are widely available in towns and city centers.",
      exchange: "Cards usually minimize exchange needs for short stays.",
      tips: [
        "Cash is less used but still useful for select vendors.",
        "Monitor peak/off-peak transit fare differences.",
      ],
    },
    links: [
      { title: "VisitBritain", url: "https://www.visitbritain.com/" },
      { title: "National Rail", url: "https://www.nationalrail.co.uk/" },
      { title: "Heathrow Airport", url: "https://www.heathrow.com/" },
    ],
  },
  Australia: {
    essentials: {
      weather: "Seasons are opposite the northern hemisphere; UV can be strong.",
      language: "English is primary.",
      currency: "Australian Dollar (AUD). Cards/contactless are standard.",
      fashion: "Sun-safe clothing, hat, and comfortable walking shoes.",
      tips: [
        "Use sunscreen daily due to high UV levels.",
        "Download offline maps for remote drives.",
      ],
    },
    transport: [
      "Public transport cards/apps vary by city.",
      "Ride-hailing is common in major cities.",
      "Regional distances are large; plan travel time conservatively.",
    ],
    money: {
      atm: "ATMs are common, but many places are near-cashless.",
      exchange: "Cards are usually sufficient for city travel.",
      tips: [
        "Keep a backup card for long regional journeys.",
        "Watch weekend/holiday transport schedules.",
      ],
    },
    links: [
      { title: "Australia.com", url: "https://www.australia.com/" },
      { title: "Transport for NSW", url: "https://transportnsw.info/" },
      { title: "Sydney Airport", url: "https://www.sydneyairport.com.au/" },
    ],
  },
  "United States": {
    essentials: {
      weather: "Conditions vary widely by state and season.",
      language: "English is primary.",
      currency: "US Dollar (USD). Cards/contactless are nearly universal.",
      fashion: "Region-specific layers and comfortable walking footwear.",
      tips: [
        "Account for tipping culture in restaurants and services.",
        "Plan transfers with city traffic windows in mind.",
      ],
    },
    transport: [
      "Ride-hailing is common in major cities.",
      "Public transit quality varies by city.",
      "Domestic flights are often best for long-distance travel.",
    ],
    money: {
      atm: "ATMs are easy to find in urban and suburban zones.",
      exchange: "Cards are usually easiest; exchange needs are limited for most travelers.",
      tips: [
        "Keep a backup payment method for car rentals/hotels.",
        "Track spend with tax/tip additions in mind.",
      ],
    },
    links: [
      { title: "Visit The USA", url: "https://www.visittheusa.com/" },
      { title: "Amtrak", url: "https://www.amtrak.com/" },
      { title: "TSA", url: "https://www.tsa.gov/" },
    ],
  },
  Canada: {
    essentials: {
      weather: "Weather can vary sharply by province and season.",
      language: "English/French vary by region; English is widespread.",
      currency: "Canadian Dollar (CAD). Cards/contactless are widely accepted.",
      fashion: "Seasonal layers; warm outerwear in colder months.",
      tips: [
        "Monitor weather forecasts for intercity plans.",
        "Use transit apps in major metro areas.",
      ],
    },
    transport: [
      "Transit is strong in major cities; intercity options vary by region.",
      "Ride-hailing is common in larger urban centers.",
      "Domestic flights are useful for long-distance routes.",
    ],
    money: {
      atm: "ATMs are common in cities and shopping centers.",
      exchange: "Cards are generally enough for everyday city travel.",
      tips: [
        "Interac/contactless is common for local payments.",
        "Keep backup cash for smaller towns.",
      ],
    },
    links: [
      { title: "Destination Canada", url: "https://www.destinationcanada.com/" },
      { title: "VIA Rail", url: "https://www.viarail.ca/en" },
      { title: "CATSA", url: "https://www.catsa-acsta.gc.ca/en" },
    ],
  },
  "New Zealand": {
    essentials: {
      weather: "Conditions can change quickly; layers are important year-round.",
      language: "English is primary.",
      currency: "New Zealand Dollar (NZD). Cards/contactless are widely used.",
      fashion: "Weather-ready layers and comfortable outdoor footwear.",
      tips: [
        "Plan drives with extra time in scenic/remote routes.",
        "Download offline maps for low-coverage stretches.",
      ],
    },
    transport: [
      "Ride-hailing is concentrated in major cities.",
      "Driving is common for regional exploration.",
      "Ferry/air links are useful between islands and long routes.",
    ],
    money: {
      atm: "ATMs are common in city and town centers.",
      exchange: "Cards are sufficient for most daily spending.",
      tips: [
        "Carry a backup card on multi-day drives.",
        "Keep small cash for local markets.",
      ],
    },
    links: [
      { title: "New Zealand Tourism", url: "https://www.newzealand.com/" },
      { title: "InterCity", url: "https://www.intercity.co.nz/" },
      { title: "Auckland Airport", url: "https://www.aucklandairport.co.nz/" },
    ],
  },
  Greece: {
    essentials: {
      weather: "Summers are hot and dry; shoulder seasons are typically pleasant.",
      language: "Greek is primary; English is common in tourist islands and cities.",
      currency: "Euro (EUR). Cards are common, with cash useful in local spots.",
      fashion: "Light breathable clothing and comfortable walking sandals/shoes.",
      tips: [
        "Download offline maps for island movement.",
        "Pre-book ferries in peak season.",
      ],
    },
    transport: [
      "City taxis and ferries are key for island-country travel.",
      "Domestic flights can save time across distant islands.",
      "Use local transit where available in major cities.",
    ],
    money: {
      atm: "ATMs are available in cities and major islands.",
      exchange: "Cards are convenient; keep euro cash for local tavernas/markets.",
      tips: [
        "Carry smaller denominations for island transport.",
        "Watch seasonal fare changes for ferries.",
      ],
    },
    links: [
      { title: "Visit Greece", url: "https://www.visitgreece.gr/" },
      { title: "Greek Ferries", url: "https://www.greekferries.gr/" },
      { title: "Athens Airport", url: "https://www.aia.gr/" },
    ],
  },
};

const DEFAULT_PRESET: GuideCountryPreset = {
  essentials: {
    weather: "Check local forecast before travel days; weather can shift by region.",
    language: "English is common in tourist areas; local language phrases still help.",
    currency: "Use local currency for day-to-day spending and keep a card backup.",
    fashion: "Comfortable layered outfits and walking shoes work for most itineraries.",
    tips: [
      "Keep offline maps and key bookings saved on phone.",
      "Carry a small cash backup for local vendors.",
    ],
  },
  transport: [
    "Use local transit and app-based rides for city travel.",
    "Pre-book intercity transport during peak dates.",
    "Keep transfer buffer for traffic and weather delays.",
  ],
  money: {
    atm: "ATMs are usually available in city/tourist centers.",
    exchange: "Use authorized counters or banks and compare rates before converting cash.",
    tips: [
      "Keep small denominations for local purchases.",
      "Track spend daily for smoother trip budgeting.",
    ],
  },
  links: [{ title: "Google Maps", url: "https://maps.google.com/" }],
};

function hasText(v: string): boolean {
  return v.trim().length > 0;
}

function isGuideCountryPreset(value: unknown): value is GuideCountryPreset {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<GuideCountryPreset>;
  if (!v.essentials || typeof v.essentials !== "object") return false;
  if (!Array.isArray(v.transport)) return false;
  if (!v.money || typeof v.money !== "object") return false;
  if (!Array.isArray(v.links)) return false;
  return true;
}

async function loadCountryPresetOverride(country: string): Promise<GuideCountryPreset | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("travel_guide_country_presets")
      .select("payload, is_active")
      .eq("country", country)
      .eq("is_active", true)
      .maybeSingle();
    if (!data?.payload) return null;
    return isGuideCountryPreset(data.payload) ? data.payload : null;
  } catch {
    return null;
  }
}

function applyPreset(base: TravelGuidesBundle, preset: GuideCountryPreset): TravelGuidesBundle {
  const essentials = {
    weather: hasText(base.essentials.weather) ? base.essentials.weather : preset.essentials.weather,
    language: hasText(base.essentials.language) ? base.essentials.language : preset.essentials.language,
    currency: hasText(base.essentials.currency) ? base.essentials.currency : preset.essentials.currency,
    fashion: hasText(base.essentials.fashion) ? base.essentials.fashion : preset.essentials.fashion,
    tips: base.essentials.tips.length > 0 ? base.essentials.tips : preset.essentials.tips,
  };
  const money = {
    atm: hasText(base.money.atm) ? base.money.atm : preset.money.atm,
    exchange: hasText(base.money.exchange) ? base.money.exchange : preset.money.exchange,
    tips: base.money.tips.length > 0 ? base.money.tips : preset.money.tips,
  };
  return {
    ...base,
    essentials,
    transport: base.transport.length > 0 ? base.transport : preset.transport,
    money,
    links: base.links.length > 0 ? base.links : preset.links,
  };
}

async function mergeGuideDefaults(base: TravelGuidesBundle, place: string): Promise<TravelGuidesBundle> {
  const intel = resolveDestination(place);
  const dbOverride = await loadCountryPresetOverride(intel.country);
  const preset = dbOverride ?? COUNTRY_PRESETS[intel.country] ?? DEFAULT_PRESET;
  return applyPreset(base, preset);
}

function normalizeSheetEnvUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return "";
  // Allow users to paste values like "<https://...>" in .env.
  if (value.startsWith("<") && value.endsWith(">")) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function buildGoogleCsvTargets(rawUrl: string): CsvTarget[] {
  const clean = normalizeSheetEnvUrl(rawUrl);
  if (!clean) return [];
  try {
    const u = new URL(clean);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    // If this is already a CSV export URL, use as-is.
    if (u.searchParams.get("output") === "csv") {
      return [{ url: u.toString(), gid: u.searchParams.get("gid") }];
    }

    // Support regular Google Sheet share/edit URLs.
    if (host.includes("docs.google.com") && path.includes("/spreadsheets/d/")) {
      const m = path.match(/\/spreadsheets\/d\/([^/]+)/);
      const sheetId = m?.[1]?.trim();
      if (!sheetId) return [{ url: clean, gid: null }];
      const gid = u.searchParams.get("gid");
      const base = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      const targets: CsvTarget[] = [];
      if (gid) targets.push({ url: `${base}&gid=${encodeURIComponent(gid)}`, gid });
      targets.push({ url: base, gid: null });
      return targets;
    }
  } catch {
    return [];
  }
  return [{ url: clean, gid: null }];
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

function detectCategory(raw: string): GuideVideoCategory | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v === "places" || v === "place" || v === "sightseeing") return "places";
  if (v === "food" || v === "foods" || v === "eat" || v === "eats") return "food";
  return null;
}

function extractYoutubeId(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] ?? "";
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v") ?? "";
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] ?? "";
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return "";
}

function resolvePlaceKeyForSheet(place: string, available: string[]): string | null {
  const compact = normalizePlaceKey(place);
  if (!compact) return null;
  if (available.includes(compact)) return compact;
  for (const key of available) {
    if (compact.includes(key) || key.includes(compact)) return key;
  }
  return null;
}

async function loadGuideVideosFromSheet(): Promise<SheetVideosByPlace> {
  const csvUrlRaw = process.env.GOOGLE_SHEETS_GUIDES_CSV_URL?.trim() ?? "";
  if (!csvUrlRaw) return {};

  const targets = buildGoogleCsvTargets(csvUrlRaw);
  if (targets.length === 0) return {};

  let text = "";
  for (const target of targets) {
    const res = await fetch(target.url, { next: { revalidate: 60 * 10 } });
    if (!res.ok) continue;
    const body = await res.text();
    // Skip HTML responses from invalid/unpublished share links.
    if (/^\s*<!doctype html/i.test(body) || /^\s*<html/i.test(body)) continue;
    text = body;
    break;
  }
  if (!text) return {};

  const rows = parseCsv(text);
  if (rows.length < 2) return {};

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const out: SheetVideosByPlace = {};

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i] ?? [];
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    const placeRaw = pick(row, ["place", "destination", "location", "city"]);
    const categoryRaw = pick(row, ["category", "type", "section", "tab"]);
    const title = pick(row, ["title", "video_title", "name"]);
    const youtubeRaw = pick(row, ["youtube_id", "video_id", "youtube", "youtube_url", "url", "link"]);
    const category = detectCategory(categoryRaw);
    const youtubeId = extractYoutubeId(youtubeRaw);
    const placeKey = normalizePlaceKey(placeRaw);

    if (!placeKey || !category || !title || !youtubeId) continue;

    if (!out[placeKey]) out[placeKey] = { places: [], food: [] };
    out[placeKey][category].push({ title, youtubeId });
  }

  return out;
}

const getCachedSheetGuides = unstable_cache(loadGuideVideosFromSheet, ["travel-os-sheet-guides-v1"], {
  revalidate: 60 * 10,
});

export async function getTravelGuidesForPlaceScalable(place: string): Promise<TravelGuidesBundle | null> {
  const fallback = getTravelGuidesForPlace(place);
  const sheet = await getCachedSheetGuides();
  const sheetKeys = Object.keys(sheet);
  const sheetKey = resolvePlaceKeyForSheet(place, sheetKeys);

  if (!sheetKey) {
    if (!fallback) return mergeGuideDefaults({
      places: [],
      food: [],
      essentials: { weather: "", language: "", currency: "", fashion: "", tips: [] },
      transport: [],
      money: { atm: "", exchange: "", tips: [] },
      links: [],
    }, place);
    return mergeGuideDefaults(fallback, place);
  }
  const sheetPlaceData = sheet[sheetKey];
  if (!sheetPlaceData) {
    if (!fallback) return null;
    return mergeGuideDefaults(fallback, place);
  }

  const baseKey = resolvePlaceGuideKey(place);
  const base =
    (baseKey ? travelGuides[baseKey] : null) ??
    fallback ??
    {
      places: [],
      food: [],
      essentials: { weather: "", language: "", currency: "", fashion: "", tips: [] },
      transport: [],
      money: { atm: "", exchange: "", tips: [] },
      links: [],
    };

  return mergeGuideDefaults({
    ...base,
    places: sheetPlaceData.places.length > 0 ? sheetPlaceData.places : base.places,
    food: sheetPlaceData.food.length > 0 ? sheetPlaceData.food : base.food,
  }, place);
}
