/** Country- and language-keyed emergency numbers / tips for the Emergency tool and related UI. */

export const EMERGENCY_LINES: Record<string, string[]> = {
  Japanese: [
    "Police: 110",
    "Ambulance / Fire: 119",
    "Japan Visitor Hotline (multilingual): 050-3816-2787",
    "Coast guard / maritime: 118",
  ],
  French: [
    "EU emergency (police / medical / fire): 112",
    "France-specific emergency: 15 (medical), 17 (police), 18 (fire)",
  ],
  Thai: [
    "Police: 191",
    "Ambulance / rescue: 1669",
    "Tourist police: 1155",
  ],
  Arabic: [
    "UAE police: 999",
    "Ambulance: 998",
    "Fire: 997",
    "Confirm numbers on arrival — emirates may differ slightly.",
  ],
  Indonesian: [
    "Police: 110",
    "Ambulance: 118",
    "Search & rescue (Bali): note local clinic + hotel concierge",
  ],
  Hindi: [
    "All-in-one emergency: 112",
    "Ambulance: 102",
    "Police: 100",
    "Fire: 101",
  ],
};

export const DEFAULT_EMERGENCY = [
  "If in the EU: 112 (police / ambulance / fire).",
  "If in doubt, ask your hotel or host for the local emergency number.",
  "Save your embassy contact before you travel.",
  "ICE: add an “In Case of Emergency” contact in your phone.",
];

export function getEmergencyLines(language: string): string[] {
  return EMERGENCY_LINES[language] ?? DEFAULT_EMERGENCY;
}
