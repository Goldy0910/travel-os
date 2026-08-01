import type { KnowledgeTopic } from "@/lib/destination-knowledge/types";

/**
 * Hand-authored knowledge overlays for RAG (independent of trip planning).
 * Topics: cost, solo/safety, internet, transport, food, nightlife, family.
 */
export type TopicKnowledge = {
  slug: string;
  cost: string;
  solo: string;
  internet: string;
  transport: string;
  food: string;
  nightlife: string;
  family: string;
};

export const TOPIC_KNOWLEDGE: TopicKnowledge[] = [
  {
    slug: "tokyo-japan",
    cost: "Japan (Tokyo) is generally expensive for Indian travellers: lodging, sit-down meals, and intercity trains add up. Daily mid-range budgets often land higher than Southeast Asia. Convenience-store meals and free walking districts help control spend. Compared with Bali or Thailand, Tokyo usually costs more per day.",
    solo: "Tokyo is one of the safest major cities for solo travellers, including solo women. Petty crime is low; main caveats are crowded trains and late-night navigation fatigue. Solo dining and nightlife are socially normal.",
    internet: "Internet quality is excellent. Free Wi‑Fi is common in stations/cafés; a pocket Wi‑Fi or eSIM is still recommended for maps and translations. Speeds support video calls and heavy browsing.",
    transport: "Local transport is world-class: JR, metro, and IC cards (Suica/Pasmo). Trains are punctual; walking + transit covers most sightseeing. Taxis are costly. From India, flights are typically 8–11 hours with a stop.",
    food: "Food culture is exceptional across budgets — ramen counters, sushi, convenience-store meals, and specialty cafés. Dietary needs are manageable with translation apps; vegetarian options exist but are less automatic than India.",
    nightlife: "Nightlife ranges from intimate izakayas to neon districts (Shinjuku, Shibuya). It is energetic but generally orderly. Cover charges and drinks can be pricey versus Bangkok or Bali.",
    family: "Family-friendly with clean facilities, theme attractions, and easy transit. Strollers are workable in many stations with elevators. Hotel rooms can feel compact for families.",
  },
  {
    slug: "bali-indonesia",
    cost: "Bali is mid-range for Indian travellers: affordable warungs and scooters, with boutique villas and beach clubs raising totals. Typically cheaper than Japan or Western Europe, similar-to-slightly-higher than Thailand depending on stay style.",
    solo: "Popular with solo travellers. Tourist areas (Canggu, Ubud, Seminyak) feel social and relatively safe; use normal precautions at night and on scooters. Solo women commonly travel here with standard awareness.",
    internet: "Internet is good in cafés and coworking hubs; villa Wi‑Fi varies. An eSIM helps for reliable maps. Speeds are usually fine for messaging and remote work in tourist belts.",
    transport: "Scooters dominate; private drivers are affordable for day trips. Traffic can be slow in south Bali. International arrivals via DPS. From India, expect ~9–12 hours with a connection.",
    food: "Strong café and warung scene, fresh produce, and vegetarian/vegan friendliness especially in Ubud. Street food is common; choose busy stalls for freshness.",
    nightlife: "Beach clubs, bars, and live music — lively in Canggu/Seminyak. Quieter in Ubud. More party-forward than Maldives or Kerala; less mega-club than Bangkok.",
    family: "Family-friendly villa stays and calm beaches exist, though scooters and uneven sidewalks need care with kids. Many families prefer resorts or private drivers over scooters.",
  },
  {
    slug: "bangkok-thailand",
    cost: "Bangkok is often excellent value: street food, BTS/MRT, and mid-range hotels keep daily costs below Japan and many Gulf/Europe cities. Luxury malls and rooftop bars can still spend like big cities.",
    solo: "Very common solo destination. Tourist zones are busy and generally manageable; use Grab, avoid common attraction scams, and keep valuables secure. Solo nightlife is easy to find.",
    internet: "Solid 4G/5G and café Wi‑Fi. Cheap local SIMs/eSIMs. Good enough for streaming and remote work in most central areas.",
    transport: "BTS/MRT, river boats, and Grab cover the city. Traffic is heavy — prefer rail when possible. Flights from India are often ~4–4.5 hours nonstop to BKK/DMK.",
    food: "World-class street food and markets. Spicy profiles are common; vegetarian options exist with some guidance. Night markets are a highlight.",
    nightlife: "One of Asia’s strongest nightlife cities — rooftops, clubs, live music, and late food. More intense than Bali’s beach-club scene or Singapore’s polished bars.",
    family: "Family attractions (malls, parks, temples) work well; humidity and traffic are the main challenges. Many hotels are family-ready.",
  },
  {
    slug: "dubai-uae",
    cost: "Dubai skews premium: hotels, attractions, and dining can be expensive, though metro travel and food courts moderate costs. Usually pricier than Thailand/Bali; can rival or exceed parts of Europe for luxury stays.",
    solo: "Very safe for solo travellers with strong policing and tourist infrastructure. Dress and public behaviour norms apply. Solo women generally report feeling secure in tourist areas.",
    internet: "Excellent connectivity and hotel Wi‑Fi. eSIM/local SIM options are straightforward. Speeds support heavy use.",
    transport: "Metro + taxis/ride-hail are reliable. Driving is optional. Nonstop flights from many Indian cities are ~3.5–4 hours.",
    food: "Global dining at every price tier — Arabic, Indian, and international. Easy for families and varied diets.",
    nightlife: "Polished hotel bars, beach clubs, and shows. Alcohol is regulated to licensed venues. Less chaotic than Bangkok nightlife.",
    family: "Extremely family-friendly: attractions, malls, and resorts are designed for kids. Summer heat is the main constraint.",
  },
  {
    slug: "singapore",
    cost: "Singapore is pricey for lodging and attractions, but hawker food keeps meals affordable. Overall cost sits above Thailand/Bali and closer to developed-city budgets.",
    solo: "Exceptionally safe for solo travel. Easy navigation and strict public rules. Solo diners are common at hawker centres.",
    internet: "Top-tier connectivity almost everywhere. eSIM/tourist SIM works well; café and MRT Wi‑Fi coverage is strong.",
    transport: "MRT is clean, frequent, and simple. Changi arrivals are smooth. Flights from India often ~5.5–6.5 hours nonstop.",
    food: "Hawker centres are the value hero — diverse, hygienic, and iconic. Excellent for trying many cuisines quickly.",
    nightlife: "Bars, lounges, and Clarke Quay energy — lively but more regulated/polished than Bangkok. Not a nonstop party island.",
    family: "Outstanding for families: compact distances, clean facilities, Sentosa, and gardens. One of the easiest first international trips with kids.",
  },
  {
    slug: "maldives",
    cost: "Among the most expensive leisure options: resort full-boards, seaplane transfers, and island premiums dominate. Rarely a budget pick versus Thailand or domestic India beaches.",
    solo: "Possible but less typical — resorts are couple/honeymoon oriented and can feel quiet/socially limited for solo travellers seeking nightlife or city energy.",
    internet: "Resort Wi‑Fi is usually good enough for messaging; speeds vary by island. Not a remote-work paradise compared with Bali coworking hubs.",
    transport: "Fly into Malé (MLE), then speedboat or seaplane. Little independent local transit on resort islands.",
    food: "Mostly resort dining — quality varies by property; seafood is common. Limited street-food culture on resort islands.",
    nightlife: "Low-key: sunset bars and resort events. Not comparable to Bangkok, Bali beach clubs, or Tokyo.",
    family: "Many family resorts exist with kids’ clubs, though overwater villas and long transfers may not suit toddlers. Generally calm and safe.",
  },
  {
    slug: "goa-india",
    cost: "Goa can be budget-to-mid for domestic travellers: guesthouses and shacks are affordable; beach clubs and peak Dec–Jan rates climb. Usually cheaper than international beach peers.",
    solo: "Popular solo destination. Beach belts are social; use normal night precautions and licensed taxis/rentals. Solo women commonly visit popular areas with awareness.",
    internet: "Decent 4G in towns; café Wi‑Fi varies. Fine for messaging; remote work is okay in popular hubs, not guaranteed everywhere.",
    transport: "Scooters, cabs, and flights into GOI/GOX. Distances between North/South beaches matter for planning.",
    food: "Seafood shacks, Goan curries, and bakery culture. Easy vegetarian options alongside fish-forward menus.",
    nightlife: "Strong beach nightlife and clubs in season, especially North Goa. Quieter in South Goa.",
    family: "South Goa and resort belts are more family-friendly than party-heavy pockets. Beaches and short hops work well with kids.",
  },
  {
    slug: "paris-france",
    cost: "Paris is expensive: lodging and dining drive costs. Museums and walking are relatively affordable once lodging is set. Typically costlier than Southeast Asia and often above Dubai food-court strategies.",
    solo: "Very doable solo. Watch pickpockets in tourist zones and metros. Solo café culture is excellent.",
    internet: "Good café and hotel Wi‑Fi; eSIM recommended. Speeds are generally reliable for maps and messaging.",
    transport: "Dense metro network; walkable neighbourhoods. Flights from India often 9–11 hours with a stop.",
    food: "Bakeries, bistros, markets — outstanding, with vegetarian options improving but less automatic than India.",
    nightlife: "Wine bars, cocktail dens, and late cafés more than mega-clubs. Romantic/leisure pacing over party-first.",
    family: "Family-friendly museums and parks; metro stairs can challenge strollers. Hotel rooms may be compact.",
  },
  {
    slug: "manali-india",
    cost: "Usually budget-to-mid domestic mountain spend. Peak snow season and adventure activities raise costs but typically stay below international alpine trips.",
    solo: "Common solo mountain destination. Road conditions and weather matter more than crime. Prefer daylight travel on mountain roads.",
    internet: "Variable — town centres okay, outskirts and high passes weak. Don’t rely on constant high-speed Wi‑Fi.",
    transport: "Overnight buses/volvos and flights via Bhuntar. Local taxis and shared cabs for nearby valleys.",
    food: "Himachali and café food, trout, Tibetan options. Comfort food is easy to find in Old Manali.",
    nightlife: "Café-and-bonfire energy more than clubs. Quiet compared with Goa or Bangkok.",
    family: "Good for families who accept cooler weather and road travel; choose stays with heating and easier access.",
  },
  {
    slug: "jaipur-india",
    cost: "Strong value for culture trips — heritage hotels span budget to luxury. Food and local transport are affordable.",
    solo: "Popular solo/culture destination. Busy bazaars need pickpocket awareness. Daytime fort circuits are straightforward.",
    internet: "Generally reliable 4G in the city; hotel Wi‑Fi varies. Fine for typical travel needs.",
    transport: "Autos, cabs, and good rail/air links from Delhi. Compact sightseeing loops are easy.",
    food: "Rajasthani thalis, sweets, and lively bazaar snacks. Vegetarian-friendly.",
    nightlife: "Rooftop hotels and cultural shows more than clubbing. Earlier evenings than beach party towns.",
    family: "Very family-friendly heritage sightseeing if heat is managed with early starts.",
  },
  {
    slug: "udaipur-india",
    cost: "Mid-range domestic romantic city — lakeside hotels vary widely; food and autos stay affordable.",
    solo: "Comfortable for solo travellers seeking calm culture. Less party chaos than Goa; evenings are mellow.",
    internet: "Decent city connectivity; lakeside cafés usually workable for messaging.",
    transport: "Compact old city + cabs/autos. Flights to UDR; scenic road links from Jaipur.",
    food: "Rajasthani cuisine, rooftop thalis, and café culture. Easy vegetarian options.",
    nightlife: "Rooftop dinners and quiet bars — not a club destination.",
    family: "Family-friendly palaces and boat rides; heat and walking hillsides are the main considerations.",
  },
  {
    slug: "rishikesh-india",
    cost: "Budget-to-mid spiritual/adventure base. Hostels and ashrams keep costs low; rafting and private stays add spend.",
    solo: "Very popular solo destination. Social cafés and yoga scene; standard river-safety awareness needed.",
    internet: "Town Wi‑Fi/4G is okay; ashram and hillside stays vary. Fine for light remote work, not guaranteed.",
    transport: "Rail to Haridwar + cab, or buses from Delhi. Local walks and shared cabs for nearby spots.",
    food: "Café culture and satvik thalis dominate. Vegetarian-friendly by default in many places.",
    nightlife: "Early evenings, music cafés, and Ganga aarti — not club nightlife.",
    family: "Good for calm family trips if adventure sports are optional; river safety with kids is essential.",
  },
  {
    slug: "andaman-india",
    cost: "Higher than many mainland beach trips due to flights and island logistics, but usually below Maldives resort pricing.",
    solo: "Doable solo, especially Havelock circuits. Quieter social scene than Goa; focus is nature and diving.",
    internet: "Patchy outside main hubs — expect slow or intermittent Wi‑Fi. Not ideal for heavy remote work.",
    transport: "Fly to Port Blair; ferries/flights between islands. Plan buffers for weather delays.",
    food: "Seafood-forward with simple island cafés. Vegetarian options exist in tourist pockets.",
    nightlife: "Low-key beach cafés; not a party destination.",
    family: "Excellent for beach families who accept ferry logistics; choose calmer beaches and reputable operators.",
  },
  {
    slug: "kerala-india",
    cost: "Flexible domestic budgets — houseboats and Ayurveda can be mid-to-premium; otherwise good value.",
    solo: "Comfortable solo, especially Kochi + backwaters with drivers. Calm pacing suits independent travellers.",
    internet: "Towns are fine; backwater stretches can be weaker. Don’t expect constant high-speed on boats.",
    transport: "Fly into COK/TRV; private drivers common for multi-town loops. Ferries/houseboats on water.",
    food: "Outstanding South-Indian cuisine — sadya, seafood, appam. Vegetarian-friendly.",
    nightlife: "Quiet — culture and cuisine over clubs.",
    family: "Very family-friendly with gentle sightseeing; choose reputable houseboat operators and life jackets.",
  },
  {
    slug: "leh-ladakh-india",
    cost: "Mid domestic adventure spend; flights and remote logistics matter more than luxury pricing. Still usually cheaper than international mountain trips.",
    solo: "Popular with solo adventure travellers. Altitude and road safety matter more than urban crime. Acclimatize properly.",
    internet: "Often weak or intermittent outside Leh town. Download offline maps. Poor remote-work destination.",
    transport: "Fly to IXL; road trips need season checks. Shared taxis and bikes are common in season.",
    food: "Simple mountain food — thukpa, momos, cafés in Leh. Options thin on remote routes.",
    nightlife: "Minimal — early nights and café hangouts.",
    family: "Better for older kids/teens who handle altitude; not ideal for infants. Build rest days.",
  },
];

/** Dedupe by slug (keep first). */
export function topicKnowledgeBySlug(): Map<string, TopicKnowledge> {
  const map = new Map<string, TopicKnowledge>();
  for (const row of TOPIC_KNOWLEDGE) {
    if (!map.has(row.slug)) map.set(row.slug, row);
  }
  return map;
}

export const TOPIC_QUERY_HINTS: Record<KnowledgeTopic, string[]> = {
  overview: ["about", "overview", "what is", "tell me about"],
  cost: ["expensive", "cost", "budget", "cheap", "price", "afford"],
  safety: ["safe", "safety", "crime", "scam"],
  solo: ["solo", "alone", "single traveller", "single traveler", "solo female", "solo woman"],
  internet: ["internet", "wifi", "wi-fi", "connectivity", "esim", "remote work"],
  transport: ["transport", "metro", "taxi", "scooter", "train", "local travel", "getting around"],
  food: ["food", "eat", "cuisine", "vegetarian", "street food", "restaurants"],
  nightlife: ["nightlife", "clubs", "bars", "party", "night life"],
  family: ["family", "kids", "children", "family-friendly", "family friendly"],
  weather: ["weather", "climate", "monsoon", "season", "best month"],
  visa: ["visa", "passport", "entry"],
  compare: ["compare", " vs ", "versus", "difference", "or"],
};
