import type { PhraseCategory } from "../types";

export const germanPhrasebook: PhraseCategory[] = [
  {
    category: "Greetings",
    phrases: [
      { english: "Hello", translated: "Hallo / Guten Tag", pronunciation: "HA-lo / GOO-ten tahk", tip: "Guten Morgen/Abend by time." },
      { english: "Thank you", translated: "Danke", pronunciation: "DAHN-kuh", tip: "Danke schön is warmer." },
      { english: "Please", translated: "Bitte", pronunciation: "BIT-tuh", tip: null },
      { english: "Goodbye", translated: "Auf Wiedersehen / Tschüss", pronunciation: "owf VEE-der-zayn / chooss", tip: "Tschüss informal." },
      { english: "Nice to meet you", translated: "Freut mich", pronunciation: "froyt mikh", tip: null },
    ],
  },
  {
    category: "Getting Around",
    phrases: [
      { english: "Where is …?", translated: "Wo ist …?", pronunciation: "voh ist …?", tip: null },
      { english: "Train station", translated: "Wo ist der Bahnhof?", pronunciation: "… der BAHN-hohf?", tip: null },
      { english: "Ticket", translated: "Eine Fahrkarte, bitte", pronunciation: "AY-nuh FAR-kar-tuh", tip: null },
      { english: "Right / Left", translated: "Rechts / Links", pronunciation: "rekhts / links", tip: null },
      { english: "Straight", translated: "Geradeaus", pronunciation: "geh-RA-de-ows", tip: null },
    ],
  },
  {
    category: "Food & Ordering",
    phrases: [
      { english: "I’d like …", translated: "Ich hätte gern …", pronunciation: "ikh HET-tuh gairn …", tip: null },
      { english: "Water", translated: "Wasser, bitte", pronunciation: "VAS-ser", tip: "Mit oder ohne Kohlensäure for sparkling." },
      { english: "The menu", translated: "Die Speisekarte, bitte", pronunciation: "dee SHPY-ze-kar-tuh", tip: null },
      { english: "The bill", translated: "Die Rechnung, bitte", pronunciation: "dee REKH-noong", tip: null },
      { english: "Vegetarian", translated: "Ich bin Vegetarier(in)", pronunciation: "… veh-geh-TAH-ree-er", tip: null },
    ],
  },
  {
    category: "Shopping & Bargaining",
    phrases: [
      { english: "How much?", translated: "Was kostet das?", pronunciation: "vas KOS-tet das?", tip: "Fixed prices in supermarkets." },
      { english: "Too expensive", translated: "Zu teuer", pronunciation: "tsoo TOY-er", tip: null },
      { english: "Card payment?", translated: "Kann ich mit Karte zahlen?", pronunciation: "kan ikh mit KAR-tuh TSAH-len?", tip: null },
      { english: "Receipt", translated: "Eine Quittung, bitte", pronunciation: "AY-nuh kvi-TOONG", tip: null },
    ],
  },
  {
    category: "Emergency & Health",
    phrases: [
      { english: "Help!", translated: "Hilfe!", pronunciation: "HIL-fuh!", tip: "EU emergency: 112." },
      { english: "Hospital", translated: "Wo ist das Krankenhaus?", pronunciation: "… KRANK-en-hows?", tip: null },
      { english: "Police", translated: "Polizei", pronunciation: "po-li-TSY", tip: "110 in Germany for police." },
      { english: "I need a doctor", translated: "Ich brauche einen Arzt", pronunciation: "ikh BROW-khuh AY-nen artst", tip: null },
      { english: "Allergy", translated: "Ich bin allergisch gegen …", pronunciation: "… al-LAIR-gish GAY-gen", tip: null },
    ],
  },
  {
    category: "Accommodation",
    phrases: [
      { english: "Reservation", translated: "Ich habe reserviert", pronunciation: "ikh HAH-buh re-zer-VEERT", tip: null },
      { english: "Room key", translated: "Der Zimmerschlüssel", pronunciation: "deer TSIM-mer-shlü-sel", tip: null },
      { english: "Wi‑Fi?", translated: "Das Wi‑Fi-Passwort?", pronunciation: "das WAI-fai pas-VORT?", tip: null },
      { english: "Checkout", translated: "Wann ist Check-out?", pronunciation: "van ist chek-out?", tip: null },
    ],
  },
  {
    category: "Numbers (1–10)",
    phrases: [
      { english: "One", translated: "eins", pronunciation: "ayns", tip: null },
      { english: "Two", translated: "zwei", pronunciation: "tsvy", tip: null },
      { english: "Three", translated: "drei", pronunciation: "dry", tip: null },
      { english: "Four", translated: "vier", pronunciation: "feer", tip: null },
      { english: "Five", translated: "fünf", pronunciation: "funf", tip: null },
      { english: "Six", translated: "sechs", pronunciation: "zekhs", tip: null },
      { english: "Seven", translated: "sieben", pronunciation: "SEE-ben", tip: null },
      { english: "Eight", translated: "acht", pronunciation: "akht", tip: null },
      { english: "Nine", translated: "neun", pronunciation: "noyn", tip: null },
      { english: "Ten", translated: "zehn", pronunciation: "tsayn", tip: null },
    ],
  },
  {
    category: "Polite Expressions",
    phrases: [
      { english: "Sorry", translated: "Entschuldigung", pronunciation: "ent-SHUL-di-goong", tip: null },
      { english: "I don’t understand", translated: "Ich verstehe nicht", pronunciation: "ikh fer-SHTAY-uh nikht", tip: null },
      { english: "English?", translated: "Sprechen Sie Englisch?", pronunciation: "SHPRE-khen zee ENG-lish?", tip: null },
      { english: "Yes / No", translated: "Ja / Nein", pronunciation: "yah / nyn", tip: null },
      { english: "Excuse me", translated: "Entschuldigung", pronunciation: "ent-SHUL-di-goong", tip: null },
    ],
  },
];
