import type { SimConnectivityBundle } from "@/app/app/esim/_lib/types";

const NOW = new Date().toISOString();

export const ESIM_CITY_DATA: Record<string, SimConnectivityBundle> = {
  bangkok: {
    city: "Bangkok",
    country: "Thailand",
    updatedAtIso: NOW,
    topCarriers: [
      {
        carrier: "AIS",
        coverage: "Excellent",
        bestOption: true,
        plans: [
          { id: "ais-7", name: "Tourist SIM", data: "15 GB", validityDays: 7, priceInr: 780 },
          { id: "ais-14", name: "Tourist SIM Plus", data: "30 GB", validityDays: 14, priceInr: 1190 },
        ],
        rechargeMethods: ["App", "USSD", "Stores"],
        airportPriceInr: 1290,
        cityPriceInr: 990,
      },
      {
        carrier: "TrueMove H",
        coverage: "Good",
        plans: [
          { id: "true-7", name: "Traveller Pack", data: "12 GB", validityDays: 7, priceInr: 730 },
          { id: "true-14", name: "Traveller Plus", data: "25 GB", validityDays: 14, priceInr: 1080 },
        ],
        rechargeMethods: ["App", "Stores"],
        airportPriceInr: 1210,
        cityPriceInr: 940,
      },
    ],
    esimProviders: [
      { provider: "Airalo", data: "10 GB", validityDays: 10, priceInr: 920, purchaseUrl: "https://www.airalo.com" },
      { provider: "Nomad", data: "15 GB", validityDays: 15, priceInr: 1190, purchaseUrl: "https://www.getnomad.app" },
    ],
    smartInsights: ["Avoid airport SIM counters for better pricing.", "Unlimited plans are often overpriced for short trips."],
  },
  dubai: {
    city: "Dubai",
    country: "UAE",
    updatedAtIso: NOW,
    topCarriers: [
      {
        carrier: "du",
        coverage: "Excellent",
        bestOption: true,
        plans: [
          { id: "du-7", name: "Tourist Plan", data: "10 GB", validityDays: 7, priceInr: 980 },
          { id: "du-14", name: "Tourist Plus", data: "22 GB", validityDays: 14, priceInr: 1480 },
        ],
        rechargeMethods: ["App", "Stores"],
        airportPriceInr: 1650,
        cityPriceInr: 1320,
      },
      {
        carrier: "Etisalat",
        coverage: "Excellent",
        plans: [
          { id: "et-7", name: "Visitor Pack", data: "8 GB", validityDays: 7, priceInr: 950 },
          { id: "et-14", name: "Visitor Plus", data: "20 GB", validityDays: 14, priceInr: 1420 },
        ],
        rechargeMethods: ["App", "USSD", "Stores"],
        airportPriceInr: 1590,
        cityPriceInr: 1290,
      },
    ],
    esimProviders: [
      { provider: "Holafly", data: "Unlimited", validityDays: 7, priceInr: 1850, purchaseUrl: "https://esim.holafly.com" },
      { provider: "Airalo", data: "20 GB", validityDays: 15, priceInr: 1720, purchaseUrl: "https://www.airalo.com" },
    ],
    smartInsights: ["Airport SIMs are convenient but usually 15-25% pricier.", "For medium usage, capped plans are better value than unlimited."],
  },
  singapore: {
    city: "Singapore",
    country: "Singapore",
    updatedAtIso: NOW,
    topCarriers: [
      {
        carrier: "Singtel",
        coverage: "Excellent",
        bestOption: true,
        plans: [
          { id: "sg-7", name: "Hi!Tourist", data: "12 GB", validityDays: 7, priceInr: 890 },
          { id: "sg-14", name: "Hi!Tourist Plus", data: "30 GB", validityDays: 14, priceInr: 1340 },
        ],
        rechargeMethods: ["App", "USSD", "Stores"],
        airportPriceInr: 1440,
        cityPriceInr: 1120,
      },
      {
        carrier: "StarHub",
        coverage: "Good",
        plans: [
          { id: "star-7", name: "Travel SIM", data: "10 GB", validityDays: 7, priceInr: 860 },
          { id: "star-14", name: "Travel SIM Plus", data: "24 GB", validityDays: 14, priceInr: 1280 },
        ],
        rechargeMethods: ["App", "Stores"],
        airportPriceInr: 1380,
        cityPriceInr: 1060,
      },
    ],
    esimProviders: [
      { provider: "Nomad", data: "20 GB", validityDays: 15, priceInr: 1480, purchaseUrl: "https://www.getnomad.app" },
      { provider: "Airalo", data: "10 GB", validityDays: 10, priceInr: 990, purchaseUrl: "https://www.airalo.com" },
    ],
    smartInsights: ["Buy in-city stores to save versus airport kiosks.", "Most travelers overpay for unlimited plans they don’t fully use."],
  },
  india: {
    city: "India",
    country: "India",
    updatedAtIso: NOW,
    topCarriers: [
      {
        carrier: "Jio",
        coverage: "Excellent",
        bestOption: true,
        plans: [
          { id: "in-jio-7", name: "Tourist Starter", data: "1.5 GB/day", validityDays: 7, priceInr: 499 },
          { id: "in-jio-14", name: "Tourist Plus", data: "2 GB/day", validityDays: 14, priceInr: 799 },
        ],
        rechargeMethods: ["App", "USSD", "Stores"],
        airportPriceInr: 1099,
        cityPriceInr: 799,
      },
      {
        carrier: "Airtel",
        coverage: "Excellent",
        plans: [
          { id: "in-airtel-7", name: "Travel Value", data: "10 GB", validityDays: 7, priceInr: 549 },
          { id: "in-airtel-14", name: "Travel Max", data: "25 GB", validityDays: 14, priceInr: 899 },
        ],
        rechargeMethods: ["App", "USSD", "Stores"],
        airportPriceInr: 1149,
        cityPriceInr: 849,
      },
    ],
    esimProviders: [
      { provider: "Airalo", data: "10 GB", validityDays: 10, priceInr: 1050, purchaseUrl: "https://www.airalo.com" },
      { provider: "Nomad", data: "15 GB", validityDays: 15, priceInr: 1390, purchaseUrl: "https://www.getnomad.app" },
    ],
    smartInsights: ["In India, city-store plans are usually cheaper than airport counters.", "UPI-enabled recharge apps make top-ups easy during trips."],
  },
  japan: {
    city: "Japan",
    country: "Japan",
    updatedAtIso: NOW,
    topCarriers: [
      {
        carrier: "NTT Docomo",
        coverage: "Excellent",
        bestOption: true,
        plans: [
          { id: "jp-docomo-7", name: "Travel Data", data: "10 GB", validityDays: 7, priceInr: 1290 },
          { id: "jp-docomo-14", name: "Travel Data Plus", data: "20 GB", validityDays: 14, priceInr: 1990 },
        ],
        rechargeMethods: ["App", "Stores"],
        airportPriceInr: 2390,
        cityPriceInr: 1890,
      },
      {
        carrier: "SoftBank",
        coverage: "Excellent",
        plans: [
          { id: "jp-softbank-7", name: "Visitor SIM", data: "8 GB", validityDays: 7, priceInr: 1190 },
          { id: "jp-softbank-14", name: "Visitor SIM Plus", data: "18 GB", validityDays: 14, priceInr: 1840 },
        ],
        rechargeMethods: ["App", "Stores"],
        airportPriceInr: 2190,
        cityPriceInr: 1790,
      },
    ],
    esimProviders: [
      { provider: "Ubigi", data: "10 GB", validityDays: 30, priceInr: 1480, purchaseUrl: "https://cellulardata.ubigi.com" },
      { provider: "Airalo", data: "10 GB", validityDays: 30, priceInr: 1590, purchaseUrl: "https://www.airalo.com" },
    ],
    smartInsights: ["Japanese airport counters are convenient but often pricier than city stores.", "For rail-heavy trips, buy before arrival to avoid activation delays."],
  },
  global: {
    city: "Global",
    country: "International",
    updatedAtIso: NOW,
    topCarriers: [
      {
        carrier: "Major Local Carrier",
        coverage: "Good",
        bestOption: true,
        plans: [
          { id: "g-7", name: "Travel Starter", data: "8 GB", validityDays: 7, priceInr: 900 },
          { id: "g-14", name: "Travel Value", data: "18 GB", validityDays: 14, priceInr: 1350 },
        ],
        rechargeMethods: ["App", "Stores"],
        airportPriceInr: 1500,
        cityPriceInr: 1200,
      },
    ],
    esimProviders: [
      { provider: "Airalo", data: "10 GB", validityDays: 10, priceInr: 1100, purchaseUrl: "https://www.airalo.com" },
      { provider: "Nomad", data: "15 GB", validityDays: 15, priceInr: 1450, purchaseUrl: "https://www.getnomad.app" },
    ],
    smartInsights: ["Avoid airport counters unless urgent connectivity is needed.", "Pick plan size by trip duration and usage to avoid overspending."],
  },
};
