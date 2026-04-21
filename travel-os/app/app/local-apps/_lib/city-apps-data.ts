import type { LocalCityApps } from "@/app/app/local-apps/_lib/types";

function toIsoMonth(value: string): string {
  return `${value}-01T00:00:00.000Z`;
}

const UPDATED_ISO = toIsoMonth("2026-04");

function mkItem(
  id: string,
  name: string,
  category: "Transport" | "Food" | "Payments" | "Navigation",
  shortTips: string[],
  fullTips: string[],
  urls: { play: string; app: string },
  mostUseful?: boolean,
) {
  return {
    id,
    name,
    category,
    rating: 4.6,
    shortTips,
    fullTips,
    playStoreUrl: urls.play,
    appStoreUrl: urls.app,
    lastUpdatedIso: UPDATED_ISO,
    ...(mostUseful ? { mostUseful: true } : {}),
  };
}

export const LOCAL_APPS_DATA: Record<string, LocalCityApps> = {
  uae: {
    city: "Dubai",
    country: "United Arab Emirates",
    mustHave: ["Google Maps", "Careem", "Talabat"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "uae-careem",
          "Careem",
          "Transport",
          ["Best for taxis and ride-hailing", "Widely used across the UAE"],
          ["Best for taxis and ride-hailing.", "Widely used across the UAE."],
          { play: "https://www.careem.com", app: "https://www.careem.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "uae-talabat",
          "Talabat",
          "Food",
          ["Dominant food delivery app in the region", "Covers restaurants, groceries, and more"],
          ["Dominant food delivery app in the region.", "Covers restaurants, groceries, and more."],
          { play: "https://www.talabat.com", app: "https://www.talabat.com" },
        ),
      ],
      Payments: [
        mkItem(
          "uae-cards-cash",
          "Cards / Cash (AED)",
          "Payments",
          ["Cards accepted almost everywhere", "Keep some AED cash for souks and smaller shops"],
          ["Cards accepted almost everywhere.", "Keep some AED cash for souks and smaller shops."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "uae-google-maps",
          "Google Maps",
          "Navigation",
          ["Reliable for driving and walking", "Works well with UAE road layouts"],
          ["Reliable for driving and walking.", "Works well with UAE road layouts."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  thailand: {
    city: "Thailand",
    country: "Thailand",
    mustHave: ["Google Maps", "Grab", "LINE MAN"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "th-grab",
          "Grab",
          "Transport",
          ["Standard ride-hailing across Bangkok and major cities", "Also covers food and deliveries"],
          ["Standard ride-hailing across Bangkok and major cities.", "Also covers food and deliveries."],
          { play: "https://grab.onelink.me", app: "https://grab.onelink.me" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "th-lineman",
          "LINE MAN",
          "Food",
          ["Most popular local food delivery app", "Covers Bangkok and tier-2 cities well"],
          ["Most popular local food delivery app.", "Covers Bangkok and tier-2 cities well."],
          { play: "https://lineman.line.me", app: "https://lineman.line.me" },
        ),
      ],
      Payments: [
        mkItem(
          "th-cards-cash",
          "Cards / Cash (THB)",
          "Payments",
          ["Cards accepted at malls and tourist spots", "Cash is essential at street food stalls and markets"],
          ["Cards accepted at malls and tourist spots.", "Cash is essential at street food stalls and markets."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "th-google-maps",
          "Google Maps",
          "Navigation",
          ["Best for Bangkok traffic and transit", "Download offline maps before heading to islands"],
          ["Best for Bangkok traffic and transit.", "Download offline maps before heading to islands."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  singapore: {
    city: "Singapore",
    country: "Singapore",
    mustHave: ["Google Maps", "Grab", "SimplyGo"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "sg-simplygo",
          "SimplyGo",
          "Transport",
          ["Tap-and-go for MRT and buses", "Works with Mastercard/Visa contactless"],
          ["Tap-and-go for MRT and buses.", "Works with Mastercard/Visa contactless."],
          { play: "https://www.simplygo.com.sg", app: "https://www.simplygo.com.sg" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "sg-grab-food",
          "Grab Food",
          "Food",
          ["Widest restaurant coverage in Singapore", "Integrated within the Grab app"],
          ["Widest restaurant coverage in Singapore.", "Integrated within the Grab app."],
          { play: "https://grab.onelink.me", app: "https://grab.onelink.me" },
        ),
      ],
      Payments: [
        mkItem(
          "sg-cards-paynow",
          "Cards / PayNow",
          "Payments",
          ["Cards accepted almost universally", "PayNow QR used widely at hawker centres"],
          ["Cards accepted almost universally.", "PayNow QR used widely at hawker centres."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "sg-google-maps",
          "Google Maps",
          "Navigation",
          ["Excellent transit coverage for MRT and buses", "Walking directions are very accurate"],
          ["Excellent transit coverage for MRT and buses.", "Walking directions are very accurate."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  maldives: {
    city: "Maldives",
    country: "Maldives",
    mustHave: ["Google Maps", "WhatsApp", "Local resort app"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "mv-transfers",
          "Speedboat / Seaplane transfers",
          "Transport",
          ["No ride-hailing apps; transfers booked via resort", "Confirm boat schedule with your accommodation"],
          ["No ride-hailing apps; transfers booked via resort.", "Confirm boat schedule with your accommodation."],
          { play: "https://www.booking.com", app: "https://www.booking.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "mv-no-delivery",
          "No major delivery app",
          "Food",
          ["Dining is mostly resort or guesthouse-based", "Male city has some local delivery options"],
          ["Dining is mostly resort or guesthouse-based.", "Male city has some local delivery options."],
          { play: "https://www.google.com/maps", app: "https://www.google.com/maps" },
        ),
      ],
      Payments: [
        mkItem(
          "mv-cards-usd",
          "Cards / USD Cash",
          "Payments",
          ["USD widely accepted alongside MVR", "Carry cash for local island shops"],
          ["USD widely accepted alongside MVR.", "Carry cash for local island shops."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "mv-google-maps",
          "Google Maps",
          "Navigation",
          ["Useful on Malé island", "Limited use on resort islands"],
          ["Useful on Malé island.", "Limited use on resort islands."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  malaysia: {
    city: "Malaysia",
    country: "Malaysia",
    mustHave: ["Google Maps", "Grab", "Touch 'n Go"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "my-grab",
          "Grab",
          "Transport",
          ["Most reliable ride-hailing across Malaysia", "Available in KL, Penang, JB, and beyond"],
          ["Most reliable ride-hailing across Malaysia.", "Available in KL, Penang, JB, and beyond."],
          { play: "https://grab.onelink.me", app: "https://grab.onelink.me" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "my-grabfood-foodpanda",
          "GrabFood / Foodpanda",
          "Food",
          ["Both have strong coverage in major cities", "Foodpanda slightly better in smaller towns"],
          ["Both have strong coverage in major cities.", "Foodpanda slightly better in smaller towns."],
          { play: "https://www.foodpanda.com", app: "https://www.foodpanda.com" },
        ),
      ],
      Payments: [
        mkItem(
          "my-tng",
          "Touch 'n Go (TNG)",
          "Payments",
          ["Used for highway tolls and transit", "E-wallet accepted at many retail spots"],
          ["Used for highway tolls and transit.", "E-wallet accepted at many retail spots."],
          { play: "https://www.touchngo.com.my", app: "https://www.touchngo.com.my" },
        ),
      ],
      Navigation: [
        mkItem(
          "my-google-maps",
          "Google Maps",
          "Navigation",
          ["Best for KL and intercity routes", "Waze also popular locally for driving"],
          ["Best for KL and intercity routes.", "Waze also popular locally for driving."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  "sri-lanka": {
    city: "Sri Lanka",
    country: "Sri Lanka",
    mustHave: ["Google Maps", "PickMe", "Cards + Cash (LKR)"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "lk-pickme",
          "PickMe",
          "Transport",
          ["Local alternative to Uber/Grab", "Available in Colombo and major towns"],
          ["Local alternative to Uber/Grab.", "Available in Colombo and major towns."],
          { play: "https://pickme.lk", app: "https://pickme.lk" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "lk-pickme-food",
          "PickMe Food",
          "Food",
          ["Widest coverage in Colombo", "Useful for quick local eats"],
          ["Widest coverage in Colombo.", "Useful for quick local eats."],
          { play: "https://pickme.lk", app: "https://pickme.lk" },
        ),
      ],
      Payments: [
        mkItem(
          "lk-cards-cash",
          "Cards / Cash (LKR)",
          "Payments",
          ["Cards accepted in Colombo and tourist areas", "Cash essential outside cities"],
          ["Cards accepted in Colombo and tourist areas.", "Cash essential outside cities."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "lk-google-maps",
          "Google Maps",
          "Navigation",
          ["Works well for Colombo city navigation", "Accuracy drops in rural and hill country areas"],
          ["Works well for Colombo city navigation.", "Accuracy drops in rural and hill country areas."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  indonesia: {
    city: "Indonesia",
    country: "Indonesia",
    mustHave: ["Google Maps", "Gojek", "GoPay"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "id-gojek",
          "Gojek",
          "Transport",
          ["Dominant super-app for rides and motorbike taxis", "GoRide is fastest for Bali and Jakarta traffic"],
          ["Dominant super-app for rides and motorbike taxis.", "GoRide is fastest for Bali and Jakarta traffic."],
          { play: "https://www.gojek.com", app: "https://www.gojek.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "id-gofood",
          "GoFood (inside Gojek)",
          "Food",
          ["Largest food delivery network in Indonesia", "Great variety from local warungs to restaurants"],
          ["Largest food delivery network in Indonesia.", "Great variety from local warungs to restaurants."],
          { play: "https://www.gojek.com", app: "https://www.gojek.com" },
        ),
      ],
      Payments: [
        mkItem(
          "id-gopay-ovo-cash",
          "GoPay / OVO / Cash (IDR)",
          "Payments",
          ["GoPay used widely within Gojek ecosystem", "Cash essential at markets and smaller vendors"],
          ["GoPay used widely within Gojek ecosystem.", "Cash essential at markets and smaller vendors."],
          { play: "https://www.gojek.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "id-google-maps",
          "Google Maps",
          "Navigation",
          ["Best for Bali and Jakarta navigation", "Download offline maps for rural areas"],
          ["Best for Bali and Jakarta navigation.", "Download offline maps for rural areas."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  india: {
    city: "India",
    country: "India",
    mustHave: ["Google Maps", "Uber", "Google Pay"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "in-uber",
          "Uber",
          "Transport",
          ["Reliable in major cities", "Check pickup point carefully at crowded areas"],
          ["Reliable in major cities.", "Check pickup point carefully at crowded areas."],
          { play: "https://www.uber.com", app: "https://www.uber.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "in-zomato-swiggy",
          "Zomato / Swiggy",
          "Food",
          ["Strong coverage in major and tier-2 cities", "Great for local food discovery"],
          ["Strong coverage in major and tier-2 cities.", "Great for local food discovery."],
          { play: "https://www.zomato.com", app: "https://www.zomato.com" },
        ),
      ],
      Payments: [
        mkItem(
          "in-upi",
          "UPI (Google Pay / PhonePe)",
          "Payments",
          ["UPI works almost everywhere", "Carry small cash for remote shops"],
          ["UPI works almost everywhere.", "Carry small cash for remote shops."],
          { play: "https://pay.google.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "in-google-maps",
          "Google Maps",
          "Navigation",
          ["Best turn-by-turn guidance", "Download offline maps before long road trips"],
          ["Best turn-by-turn guidance.", "Download offline maps before long road trips."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  nepal: {
    city: "Nepal",
    country: "Nepal",
    mustHave: ["Google Maps", "inDrive", "Cards + Cash (NPR)"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "np-indrive",
          "inDrive",
          "Transport",
          ["Available in Kathmandu for budget rides", "Negotiate fares directly with drivers"],
          ["Available in Kathmandu for budget rides.", "Negotiate fares directly with drivers."],
          { play: "https://indrive.com", app: "https://indrive.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "np-foodmandu",
          "Bhoj Delivery / Foodmandu",
          "Food",
          ["Foodmandu is the most established local app", "Coverage mainly in Kathmandu Valley"],
          ["Foodmandu is the most established local app.", "Coverage mainly in Kathmandu Valley."],
          { play: "https://foodmandu.com", app: "https://foodmandu.com" },
        ),
      ],
      Payments: [
        mkItem(
          "np-cash",
          "Cash (NPR)",
          "Payments",
          ["Cash is king across Nepal", "Cards accepted at some Thamel hotels and shops"],
          ["Cash is king across Nepal.", "Cards accepted at some Thamel hotels and shops."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "np-google-maps",
          "Google Maps",
          "Navigation",
          ["Works in Kathmandu and Pokhara", "Offline maps strongly recommended for trekking areas"],
          ["Works in Kathmandu and Pokhara.", "Offline maps strongly recommended for trekking areas."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  vietnam: {
    city: "Vietnam",
    country: "Vietnam",
    mustHave: ["Google Maps", "Grab", "VietQR"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "vn-grab",
          "Grab",
          "Transport",
          ["Standard for GrabBike and GrabCar", "Very affordable across major cities"],
          ["Standard for GrabBike and GrabCar.", "Very affordable across major cities."],
          { play: "https://grab.onelink.me", app: "https://grab.onelink.me" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "vn-shopeefood-grabfood",
          "ShopeeFood / GrabFood",
          "Food",
          ["ShopeeFood popular locally; GrabFood reliable for tourists", "Both cover Hanoi, Ho Chi Minh City, Da Nang"],
          ["ShopeeFood popular locally; GrabFood reliable for tourists.", "Both cover Hanoi, Ho Chi Minh City, Da Nang."],
          { play: "https://shopeefood.vn", app: "https://grab.onelink.me" },
        ),
      ],
      Payments: [
        mkItem(
          "vn-vietqr-cash",
          "VietQR / Cash (VND)",
          "Payments",
          ["QR payments growing rapidly in cities", "Cash still important in local markets and smaller towns"],
          ["QR payments growing rapidly in cities.", "Cash still important in local markets and smaller towns."],
          { play: "https://vietqr.net", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "vn-google-maps",
          "Google Maps",
          "Navigation",
          ["Reliable in cities", "Useful for finding hidden alley restaurants"],
          ["Reliable in cities.", "Useful for finding hidden alley restaurants."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  turkey: {
    city: "Turkey",
    country: "Turkey",
    mustHave: ["Google Maps", "BiTaksi", "Getir"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "tr-bitaksi",
          "BiTaksi",
          "Transport",
          ["Best app for booking taxis in Istanbul", "More reliable than hailing on the street"],
          ["Best app for booking taxis in Istanbul.", "More reliable than hailing on the street."],
          { play: "https://www.bitaksi.com", app: "https://www.bitaksi.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "tr-yemeksepeti-getir",
          "Yemeksepeti / Getir",
          "Food",
          ["Yemeksepeti is the largest food delivery platform", "Getir great for quick grocery and snack delivery"],
          ["Yemeksepeti is the largest food delivery platform.", "Getir great for quick grocery and snack delivery."],
          { play: "https://www.getir.com", app: "https://www.getir.com" },
        ),
      ],
      Payments: [
        mkItem(
          "tr-cards-cash",
          "Cards / Cash (TRY)",
          "Payments",
          ["Cards widely accepted in Istanbul", "Keep lira cash for bazaars and smaller eateries"],
          ["Cards widely accepted in Istanbul.", "Keep lira cash for bazaars and smaller eateries."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "tr-google-maps",
          "Google Maps",
          "Navigation",
          ["Good for Istanbul and coastal cities", "Download offline for Cappadocia and rural regions"],
          ["Good for Istanbul and coastal cities.", "Download offline for Cappadocia and rural regions."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  switzerland: {
    city: "Switzerland",
    country: "Switzerland",
    mustHave: ["SBB Mobile", "Google Maps", "Twint"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "ch-sbb-mobile",
          "SBB Mobile",
          "Transport",
          ["Official Swiss rail app for trains, buses, and trams", "Buy tickets and check live departures"],
          ["Official Swiss rail app for trains, buses, and trams.", "Buy tickets and check live departures."],
          { play: "https://www.sbb.ch", app: "https://www.sbb.ch" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "ch-ubereats-eatch",
          "Uber Eats / Eat.ch",
          "Food",
          ["Eat.ch is the dominant local platform", "Uber Eats available in Zurich and Geneva"],
          ["Eat.ch is the dominant local platform.", "Uber Eats available in Zurich and Geneva."],
          { play: "https://www.just-eat.ch", app: "https://www.just-eat.ch" },
        ),
      ],
      Payments: [
        mkItem(
          "ch-cards-twint",
          "Cards / Twint",
          "Payments",
          ["Cards accepted nearly everywhere", "Twint is the Swiss-native mobile payment app"],
          ["Cards accepted nearly everywhere.", "Twint is the Swiss-native mobile payment app."],
          { play: "https://www.twint.ch", app: "https://www.twint.ch" },
        ),
      ],
      Navigation: [
        mkItem(
          "ch-google-maps",
          "Google Maps",
          "Navigation",
          ["Works well across cities and mountain towns", "SBB app better for transit-specific routing"],
          ["Works well across cities and mountain towns.", "SBB app better for transit-specific routing."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  france: {
    city: "France",
    country: "France",
    mustHave: ["Google Maps", "SNCF Connect", "Navigo (Paris)"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "fr-sncf-connect",
          "SNCF Connect",
          "Transport",
          ["Book intercity trains and TGV", "Essential for travel between cities"],
          ["Book intercity trains and TGV.", "Essential for travel between cities."],
          { play: "https://www.sncf-connect.com", app: "https://www.sncf-connect.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "fr-ubereats-deliveroo",
          "Uber Eats / Deliveroo",
          "Food",
          ["Both have strong coverage in Paris and major cities", "Deliveroo slightly preferred locally"],
          ["Both have strong coverage in Paris and major cities.", "Deliveroo slightly preferred locally."],
          { play: "https://deliveroo.fr", app: "https://deliveroo.fr" },
        ),
      ],
      Payments: [
        mkItem(
          "fr-cards",
          "Cards",
          "Payments",
          ["Chip-and-pin cards accepted almost universally", "Some markets and rural bakeries prefer cash"],
          ["Chip-and-pin cards accepted almost universally.", "Some markets and rural bakeries prefer cash."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "fr-maps-citymapper",
          "Google Maps / Citymapper",
          "Navigation",
          ["Citymapper excellent for Paris metro navigation", "Google Maps reliable for walking and driving"],
          ["Citymapper excellent for Paris metro navigation.", "Google Maps reliable for walking and driving."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  italy: {
    city: "Italy",
    country: "Italy",
    mustHave: ["Google Maps", "Trenitalia / Italo", "Cards + Cash"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "it-trenitalia",
          "Trenitalia",
          "Transport",
          ["Book regional and intercity trains", "Italo is an alternative for high-speed routes"],
          ["Book regional and intercity trains.", "Italo is an alternative for high-speed routes."],
          { play: "https://www.trenitalia.com", app: "https://www.trenitalia.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "it-deliveroo-ubereats",
          "Deliveroo / Uber Eats",
          "Food",
          ["Deliveroo strong in major Italian cities", "Worth checking both for coverage in your city"],
          ["Deliveroo strong in major Italian cities.", "Worth checking both for coverage in your city."],
          { play: "https://deliveroo.it", app: "https://deliveroo.it" },
        ),
      ],
      Payments: [
        mkItem(
          "it-cards-cash",
          "Cards / Cash (EUR)",
          "Payments",
          ["Cards accepted in cities and tourist areas", "Cash preferred at trattorias, markets, and taxis"],
          ["Cards accepted in cities and tourist areas.", "Cash preferred at trattorias, markets, and taxis."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "it-google-maps",
          "Google Maps",
          "Navigation",
          ["Reliable across Italian cities", "Useful for finding restaurants down narrow lanes"],
          ["Reliable across Italian cities.", "Useful for finding restaurants down narrow lanes."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  uk: {
    city: "United Kingdom",
    country: "United Kingdom",
    mustHave: ["Google Maps", "Citymapper", "Monzo / Revolut"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "uk-citymapper",
          "Citymapper",
          "Transport",
          ["Best app for London transit", "Covers major UK cities including Manchester and Edinburgh"],
          ["Best app for London transit (tube, bus, Elizabeth line).", "Covers major UK cities including Manchester and Edinburgh."],
          { play: "https://citymapper.com", app: "https://citymapper.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "uk-deliveroo-ubereats-justeat",
          "Deliveroo / Uber Eats / Just Eat",
          "Food",
          ["Deliveroo and Just Eat dominate the UK market", "All three have wide coverage across cities and towns"],
          ["Deliveroo and Just Eat dominate the UK market.", "All three have wide coverage across cities and towns."],
          { play: "https://www.just-eat.co.uk", app: "https://www.just-eat.co.uk" },
        ),
      ],
      Payments: [
        mkItem(
          "uk-cards-wallet",
          "Cards / Apple Pay / Google Pay",
          "Payments",
          ["Contactless payments accepted almost universally", "Cash rarely needed but handy for smaller vendors"],
          ["Contactless payments accepted almost universally.", "Cash rarely needed but handy for smaller vendors."],
          { play: "https://pay.google.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "uk-google-maps",
          "Google Maps",
          "Navigation",
          ["Reliable across England, Scotland, and Wales", "Citymapper better for tube-heavy city navigation"],
          ["Reliable across England, Scotland, and Wales.", "Citymapper better for tube-heavy city navigation."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  australia: {
    city: "Australia",
    country: "Australia",
    mustHave: ["Google Maps", "Uber", "Opal / Myki"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "au-opal-myki",
          "Opal (Sydney) / Myki (Melbourne)",
          "Transport",
          ["Tap-on tap-off transit cards for trains, buses, ferries", "Load via app or at station kiosks"],
          ["Tap-on tap-off transit cards for trains, buses, ferries.", "Load via app or at station kiosks."],
          { play: "https://transportnsw.info", app: "https://www.ptv.vic.gov.au" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "au-ubereats-doordash",
          "Uber Eats / DoorDash",
          "Food",
          ["Both have extensive coverage across major cities", "DoorDash growing fast in suburban areas"],
          ["Both have extensive coverage across major cities.", "DoorDash growing fast in suburban areas."],
          { play: "https://www.doordash.com", app: "https://www.doordash.com" },
        ),
      ],
      Payments: [
        mkItem(
          "au-cards-applepay",
          "Cards / Apple Pay",
          "Payments",
          ["Contactless widely accepted, even at small cafes", "Australia is nearly cashless in cities"],
          ["Contactless widely accepted, even at small cafes.", "Australia is nearly cashless in cities."],
          { play: "https://pay.google.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "au-google-maps",
          "Google Maps",
          "Navigation",
          ["Works great across cities and regional areas", "Download offline for outback or remote road trips"],
          ["Works great across cities and regional areas.", "Download offline for outback or remote road trips."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  japan: {
    city: "Japan",
    country: "Japan",
    mustHave: ["Google Maps", "Japan Travel by NAVITIME", "Suica"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "jp-navitime",
          "Japan Travel by NAVITIME",
          "Transport",
          ["Best for train routes", "Shows platform details and transfers"],
          ["Best for train routes.", "Shows platform details and transfers."],
          { play: "https://japantravel.navitime.com/en/", app: "https://japantravel.navitime.com/en/" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "jp-tabelog",
          "Tabelog",
          "Food",
          ["Great local restaurant discovery", "Useful ratings for nearby places"],
          ["Great local restaurant discovery.", "Useful ratings for nearby places."],
          { play: "https://tabelog.com/en/", app: "https://tabelog.com/en/" },
        ),
      ],
      Payments: [
        mkItem(
          "jp-paypay-cards",
          "PayPay / Cards",
          "Payments",
          ["Cards work in tourist zones", "Keep cash for smaller local shops"],
          ["Cards work in tourist zones.", "Keep cash for smaller local shops."],
          { play: "https://paypay.ne.jp", app: "https://paypay.ne.jp" },
        ),
      ],
      Navigation: [
        mkItem(
          "jp-google-maps",
          "Google Maps",
          "Navigation",
          ["Reliable walking + train navigation", "Download offline areas before travel"],
          ["Reliable walking + train navigation.", "Download offline areas before travel."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  usa: {
    city: "United States",
    country: "United States",
    mustHave: ["Google Maps", "Uber / Lyft", "Apple Pay / Google Pay"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "us-uber-lyft",
          "Uber / Lyft",
          "Transport",
          ["Standard ride-hailing across all major cities", "Lyft slightly cheaper in some markets"],
          ["Standard ride-hailing across all major cities.", "Lyft slightly cheaper in some markets."],
          { play: "https://www.uber.com", app: "https://www.uber.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "us-doordash-ubereats",
          "DoorDash / Uber Eats",
          "Food",
          ["DoorDash has the widest restaurant coverage nationally", "Uber Eats strong in urban centres"],
          ["DoorDash has the widest restaurant coverage nationally.", "Uber Eats strong in urban centres."],
          { play: "https://www.doordash.com", app: "https://www.doordash.com" },
        ),
      ],
      Payments: [
        mkItem(
          "us-cards-wallet",
          "Cards / Apple Pay / Google Pay",
          "Payments",
          ["Contactless and card payments accepted everywhere", "Tipping culture: add 15-20% at restaurants"],
          ["Contactless and card payments accepted everywhere.", "Tipping culture: always add 15-20% at restaurants."],
          { play: "https://pay.google.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "us-maps",
          "Google Maps / Apple Maps",
          "Navigation",
          ["Both reliable for driving and walking", "Apple Maps excellent for iPhone users in cities"],
          ["Both reliable for driving and walking.", "Apple Maps excellent for iPhone users in cities."],
          { play: "https://maps.google.com", app: "https://maps.apple.com" },
        ),
      ],
    },
  },
  canada: {
    city: "Canada",
    country: "Canada",
    mustHave: ["Google Maps", "Uber", "PRESTO / Transit app"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "ca-uber",
          "Uber",
          "Transport",
          ["Available in Toronto, Vancouver, Montreal, and beyond", "Lyft also available in major cities"],
          ["Available in Toronto, Vancouver, Montreal, and beyond.", "Lyft also available in major cities."],
          { play: "https://www.uber.com", app: "https://www.uber.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "ca-food-delivery",
          "DoorDash / Uber Eats / SkipTheDishes",
          "Food",
          ["SkipTheDishes is Canada's homegrown delivery app", "All three widely used in major cities"],
          ["SkipTheDishes is Canada's homegrown delivery app.", "All three widely used in major cities."],
          { play: "https://www.skipthedishes.com", app: "https://www.skipthedishes.com" },
        ),
      ],
      Payments: [
        mkItem(
          "ca-cards-interac",
          "Cards / Interac",
          "Payments",
          ["Cards and tap-to-pay accepted almost universally", "Interac Debit is the local debit standard"],
          ["Cards and tap-to-pay accepted almost universally.", "Interac Debit is the local debit standard."],
          { play: "https://www.interac.ca", app: "https://www.interac.ca" },
        ),
      ],
      Navigation: [
        mkItem(
          "ca-maps-transit",
          "Google Maps / Transit App",
          "Navigation",
          ["Transit app excellent for bus and subway", "Google Maps reliable for driving across provinces"],
          ["Transit app excellent for bus and subway in Toronto and Montreal.", "Google Maps reliable for driving across provinces."],
          { play: "https://maps.google.com", app: "https://transitapp.com" },
        ),
      ],
    },
  },
  "new-zealand": {
    city: "New Zealand",
    country: "New Zealand",
    mustHave: ["Google Maps", "Uber", "AT HOP / Snapper"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "nz-uber",
          "Uber",
          "Transport",
          ["Available in Auckland, Wellington, and Christchurch", "Only major ride-hailing option in NZ"],
          ["Available in Auckland, Wellington, and Christchurch.", "Only major ride-hailing option in NZ."],
          { play: "https://www.uber.com", app: "https://www.uber.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "nz-ubereats-doordash",
          "Uber Eats / DoorDash",
          "Food",
          ["Uber Eats dominant in Auckland and Wellington", "DoorDash growing in coverage"],
          ["Uber Eats dominant in Auckland and Wellington.", "DoorDash growing in coverage."],
          { play: "https://www.doordash.com", app: "https://www.doordash.com" },
        ),
      ],
      Payments: [
        mkItem(
          "nz-cards-applepay",
          "Cards / Apple Pay",
          "Payments",
          ["New Zealand is highly cashless", "Contactless widely accepted including at markets"],
          ["New Zealand is highly cashless.", "Contactless widely accepted including at markets."],
          { play: "https://pay.google.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "nz-google-maps",
          "Google Maps",
          "Navigation",
          ["Works well across North and South Islands", "Download offline maps for Fiordland and remote areas"],
          ["Works well across North and South Islands.", "Download offline maps for Fiordland and remote areas."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  greece: {
    city: "Greece",
    country: "Greece",
    mustHave: ["Google Maps", "Beat", "Cards + Cash (EUR)"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "gr-beat",
          "Beat",
          "Transport",
          ["Most popular taxi app in Athens", "More affordable than traditional taxis"],
          ["Most popular taxi app in Athens.", "More affordable than traditional taxis."],
          { play: "https://thebeat.co", app: "https://thebeat.co" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "gr-efood-wolt",
          "efood / Wolt",
          "Food",
          ["efood is Greece's dominant local delivery platform", "Wolt available in Athens and Thessaloniki"],
          ["efood is Greece's dominant local delivery platform.", "Wolt available in Athens and Thessaloniki."],
          { play: "https://www.e-food.gr", app: "https://www.e-food.gr" },
        ),
      ],
      Payments: [
        mkItem(
          "gr-cards-cash",
          "Cards / Cash (EUR)",
          "Payments",
          ["Cards accepted at restaurants and shops in cities", "Cash preferred at local tavernas and island markets"],
          ["Cards accepted at restaurants and shops in cities.", "Cash preferred at local tavernas and island markets."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "gr-google-maps",
          "Google Maps",
          "Navigation",
          ["Reliable in Athens and coastal cities", "Download offline maps for island travel"],
          ["Reliable in Athens and coastal cities.", "Download offline maps for island travel."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
  global: {
    city: "Global",
    country: "International",
    mustHave: ["Google Maps", "Uber / Lyft", "Cards / Cash"],
    lastUpdatedIso: UPDATED_ISO,
    categories: {
      Transport: [
        mkItem(
          "global-transport",
          "Uber / Lyft",
          "Transport",
          ["Works in many countries", "Check regional availability"],
          ["Works in many countries.", "Check regional availability."],
          { play: "https://www.uber.com", app: "https://www.uber.com" },
          true,
        ),
      ],
      Food: [
        mkItem(
          "global-food",
          "Uber Eats / DoorDash",
          "Food",
          ["Useful defaults when local apps are unknown", "Check coverage city-by-city"],
          ["Useful defaults when local apps are unknown.", "Check coverage city-by-city."],
          { play: "https://www.ubereats.com", app: "https://www.ubereats.com" },
        ),
      ],
      Payments: [
        mkItem(
          "global-payments",
          "Cards / Cash",
          "Payments",
          ["Cards accepted in most major tourist areas", "Carry local cash for markets and small vendors"],
          ["Cards accepted in most major tourist areas.", "Carry local cash for markets and small vendors."],
          { play: "https://www.visa.com", app: "https://www.apple.com/wallet/" },
        ),
      ],
      Navigation: [
        mkItem(
          "global-navigation",
          "Google Maps",
          "Navigation",
          ["Best default navigation", "Save offline regions"],
          ["Best default navigation.", "Save offline regions."],
          { play: "https://maps.google.com", app: "https://maps.google.com" },
        ),
      ],
    },
  },
};
