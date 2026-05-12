import type { PhraseCategory } from "../types";

export const frenchPhrasebook: PhraseCategory[] = [
  {
    category: "Greetings",
    phrases: [
      { english: "Hello", translated: "Bonjour", pronunciation: "bon-ZHOOR", tip: "Bonsoir after ~6pm." },
      { english: "Thank you", translated: "Merci", pronunciation: "mer-SEE", tip: "Merci beaucoup for emphasis." },
      { english: "Please", translated: "S’il vous plaît", pronunciation: "seel voo PLAY", tip: null },
      { english: "Goodbye", translated: "Au revoir", pronunciation: "oh ruh-VWAR", tip: "Salut is informal hi/bye." },
      { english: "Nice to meet you", translated: "Enchanté(e)", pronunciation: "on-shon-TAY", tip: "Add e if feminine." },
    ],
  },
  {
    category: "Getting Around",
    phrases: [
      { english: "Where is …?", translated: "Où est … ?", pronunciation: "oo ay …?", tip: null },
      { english: "Metro", translated: "Où est le métro ?", pronunciation: "oo ay luh may-TRO?", tip: null },
      { english: "Ticket", translated: "Un billet, s’il vous plaît", pronunciation: "uhn bee-YAY", tip: null },
      { english: "Right / Left", translated: "À droite / À gauche", pronunciation: "a DRWAT / a GOHSH", tip: null },
      { english: "Straight", translated: "Tout droit", pronunciation: "too DRWAH", tip: null },
    ],
  },
  {
    category: "Food & Ordering",
    phrases: [
      { english: "I’d like …", translated: "Je voudrais …", pronunciation: "zhuh voo-DRAY …", tip: null },
      { english: "Water", translated: "De l’eau, s’il vous plaît", pronunciation: "duh LOH", tip: "Eau plate / gazeuse for still/sparkling." },
      { english: "The menu", translated: "La carte, s’il vous plaît", pronunciation: "la kart", tip: null },
      { english: "The bill", translated: "L’addition, s’il vous plaît", pronunciation: "la-dee-SYON", tip: null },
      { english: "Delicious", translated: "C’était délicieux", pronunciation: "say-TAY day-lee-SYUH", tip: null },
    ],
  },
  {
    category: "Shopping & Bargaining",
    phrases: [
      { english: "How much?", translated: "C’est combien ?", pronunciation: "say kom-BYAN?", tip: "Markets may negotiate; chains usually not." },
      { english: "Too expensive", translated: "C’est trop cher", pronunciation: "say troh SHAIR", tip: null },
      { english: "I’m just looking", translated: "Je regarde seulement", pronunciation: "zhuh ruh-GARD suhl-MAHN", tip: null },
      { english: "Bag", translated: "Un sac, s’il vous plaît", pronunciation: "uhn sak", tip: null },
    ],
  },
  {
    category: "Emergency & Health",
    phrases: [
      { english: "Help!", translated: "À l’aide !", pronunciation: "ah LED!", tip: "EU emergency: 112." },
      { english: "Hospital", translated: "Où est l’hôpital ?", pronunciation: "oo ay loh-pee-TAL?", tip: null },
      { english: "Police", translated: "Police", pronunciation: "po-LEES", tip: "17 for police in France." },
      { english: "I’m sick", translated: "Je suis malade", pronunciation: "zhuh swee ma-LAD", tip: null },
      { english: "Allergy", translated: "Je suis allergique à …", pronunciation: "zhuh swee za-lair-ZHEEK a …", tip: null },
    ],
  },
  {
    category: "Accommodation",
    phrases: [
      { english: "Reservation", translated: "J’ai une réservation", pronunciation: "zhay oon ray-zer-va-SYON", tip: null },
      { english: "Room key", translated: "La clé de la chambre", pronunciation: "la klay duh la SHAHMBR", tip: null },
      { english: "Wi‑Fi?", translated: "Le mot de passe du Wi‑Fi ?", pronunciation: "luh moh duh pahs …", tip: null },
      { english: "Checkout", translated: "À quelle heure est le départ ?", pronunciation: "a kel ur ay luh day-PAR?", tip: null },
    ],
  },
  {
    category: "Numbers (1–10)",
    phrases: [
      { english: "One", translated: "un", pronunciation: "uhn", tip: null },
      { english: "Two", translated: "deux", pronunciation: "duh", tip: null },
      { english: "Three", translated: "trois", pronunciation: "trwah", tip: null },
      { english: "Four", translated: "quatre", pronunciation: "KA-truh", tip: null },
      { english: "Five", translated: "cinq", pronunciation: "sank", tip: null },
      { english: "Six", translated: "six", pronunciation: "sees", tip: null },
      { english: "Seven", translated: "sept", pronunciation: "set", tip: null },
      { english: "Eight", translated: "huit", pronunciation: "weet", tip: null },
      { english: "Nine", translated: "neuf", pronunciation: "nuhf", tip: null },
      { english: "Ten", translated: "dix", pronunciation: "dees", tip: null },
    ],
  },
  {
    category: "Polite Expressions",
    phrases: [
      { english: "Sorry", translated: "Pardon", pronunciation: "par-DON", tip: "Désolé(e) for apologies." },
      { english: "I don’t understand", translated: "Je ne comprends pas", pronunciation: "zhuh nuh kom-PRAHN pah", tip: null },
      { english: "English?", translated: "Parlez-vous anglais ?", pronunciation: "par-lay voo ahn-GLEH?", tip: null },
      { english: "Yes / No", translated: "Oui / Non", pronunciation: "wee / nohn", tip: null },
      { english: "Excuse me", translated: "Excusez-moi", pronunciation: "eks-kew-zay MWAH", tip: null },
    ],
  },
];
