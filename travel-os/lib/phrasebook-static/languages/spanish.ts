import type { PhraseCategory } from "../types";

export const spanishPhrasebook: PhraseCategory[] = [
  {
    category: "Greetings",
    phrases: [
      { english: "Hello", translated: "Hola", pronunciation: "OH-la", tip: "Buenos días / tardes / noches by time of day." },
      { english: "Thank you", translated: "Gracias", pronunciation: "GRA-syas", tip: "Muchas gracias for extra thanks." },
      { english: "Please", translated: "Por favor", pronunciation: "por fa-VOR", tip: null },
      { english: "How are you?", translated: "¿Cómo está?", pronunciation: "KOH-mo es-TA?", tip: "Use tú form cómo estás with peers." },
      { english: "Goodbye", translated: "Adiós", pronunciation: "a-DYOS", tip: "Hasta luego is casual see-you." },
    ],
  },
  {
    category: "Getting Around",
    phrases: [
      { english: "Where is …?", translated: "¿Dónde está …?", pronunciation: "DON-de es-TA …?", tip: null },
      { english: "Bus stop", translated: "¿Dónde está la parada de autobús?", pronunciation: "… pa-RA-da de ow-to-BOOS", tip: null },
      { english: "Ticket", translated: "Un billete, por favor", pronunciation: "oon bee-YE-te", tip: "Boleto in Latin America." },
      { english: "Left / Right", translated: "Izquierda / Derecha", pronunciation: "is-KYER-da / DE-re-cha", tip: null },
      { english: "Straight ahead", translated: "Todo recto", pronunciation: "TO-do REK-to", tip: null },
    ],
  },
  {
    category: "Food & Ordering",
    phrases: [
      { english: "I’d like this", translated: "Quiero esto, por favor", pronunciation: "kye-RO ES-to", tip: null },
      { english: "Water", translated: "Agua, por favor", pronunciation: "A-gwa", tip: "Agua sin gas / con gas for still/sparkling." },
      { english: "No meat", translated: "Sin carne, por favor", pronunciation: "seen KAR-ne", tip: null },
      { english: "The bill", translated: "La cuenta, por favor", pronunciation: "la KWEN-ta", tip: null },
      { english: "Delicious", translated: "Está delicioso", pronunciation: "es-TA de-lee-SYO-so", tip: null },
    ],
  },
  {
    category: "Shopping & Bargaining",
    phrases: [
      { english: "How much?", translated: "¿Cuánto cuesta?", pronunciation: "KWAN-to KWES-ta?", tip: null },
      { english: "Too expensive", translated: "Es muy caro", pronunciation: "es mwee KA-ro", tip: null },
      { english: "Can you lower the price?", translated: "¿Puede bajar un poco?", pronunciation: "PWE-de ba-HAR oon PO-ko", tip: null },
      { english: "I’ll take it", translated: "Me lo llevo", pronunciation: "me lo YE-vo", tip: null },
    ],
  },
  {
    category: "Emergency & Health",
    phrases: [
      { english: "Help!", translated: "¡Ayuda!", pronunciation: "ah-YOO-da!", tip: "EU: 112; Spain also uses local numbers." },
      { english: "I need a doctor", translated: "Necesito un médico", pronunciation: "ne-se-SEE-to oon ME-dee-ko", tip: null },
      { english: "Police", translated: "Policía", pronunciation: "po-lee-SEE-a", tip: null },
      { english: "Hospital", translated: "¿Dónde está el hospital?", pronunciation: "… os-pee-TAL", tip: null },
      { english: "Allergy", translated: "Soy alérgico/a a …", pronunciation: "soy a-LER-hee-ko …", tip: "Match gender to speaker." },
    ],
  },
  {
    category: "Accommodation",
    phrases: [
      { english: "Reservation", translated: "Tengo una reserva", pronunciation: "TEN-go OO-na re-SER-va", tip: null },
      { english: "Room key", translated: "La llave de la habitación", pronunciation: "la YA-be … a-bi-ta-SYON", tip: null },
      { english: "Wi‑Fi?", translated: "¿Cuál es la contraseña del Wi‑Fi?", pronunciation: "kwal es la kon-tra-SEN-ya", tip: null },
      { english: "Checkout", translated: "¿A qué hora es la salida?", pronunciation: "a ke O-ra es la sa-LEE-da", tip: null },
    ],
  },
  {
    category: "Numbers (1–10)",
    phrases: [
      { english: "One", translated: "uno", pronunciation: "OO-no", tip: null },
      { english: "Two", translated: "dos", pronunciation: "dos", tip: null },
      { english: "Three", translated: "tres", pronunciation: "tres", tip: null },
      { english: "Four", translated: "cuatro", pronunciation: "KWAT-ro", tip: null },
      { english: "Five", translated: "cinco", pronunciation: "THEEN-ko", tip: null },
      { english: "Six", translated: "seis", pronunciation: "says", tip: null },
      { english: "Seven", translated: "siete", pronunciation: "SYE-te", tip: null },
      { english: "Eight", translated: "ocho", pronunciation: "O-cho", tip: null },
      { english: "Nine", translated: "nueve", pronunciation: "NWE-be", tip: null },
      { english: "Ten", translated: "diez", pronunciation: "dyeth", tip: null },
    ],
  },
  {
    category: "Polite Expressions",
    phrases: [
      { english: "Sorry", translated: "Lo siento", pronunciation: "lo SYEN-to", tip: null },
      { english: "I don’t understand", translated: "No entiendo", pronunciation: "no en-TYEN-do", tip: null },
      { english: "Do you speak English?", translated: "¿Habla inglés?", pronunciation: "AB-la een-GLES?", tip: null },
      { english: "Yes / No", translated: "Sí / No", pronunciation: "see / no", tip: null },
      { english: "Excuse me", translated: "Perdón / Disculpe", pronunciation: "per-DON / dis-KUL-pe", tip: "Disculpe is more formal." },
    ],
  },
];
