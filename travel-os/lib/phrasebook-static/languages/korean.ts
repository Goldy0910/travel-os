import type { PhraseCategory } from "../types";

export const koreanPhrasebook: PhraseCategory[] = [
  {
    category: "Greetings",
    phrases: [
      { english: "Hello", translated: "안녕하세요", pronunciation: "an-nyeong-ha-se-yo", tip: "Use annyeong with close friends only." },
      { english: "Thank you", translated: "감사합니다", pronunciation: "gam-sa-ham-ni-da", tip: "Gomawoyo is informal thanks." },
      { english: "Excuse me", translated: "실례합니다", pronunciation: "sil-lye-ham-ni-da", tip: "Also say jeogiyo to call staff." },
      { english: "Nice to meet you", translated: "만나서 반갑습니다", pronunciation: "man-na-seo ban-gap-seum-ni-da", tip: null },
      { english: "Goodbye", translated: "안녕히 가세요", pronunciation: "an-nyeong-hi ga-se-yo", tip: "Say when they stay, you leave; gasayo vs gaseyo." },
    ],
  },
  {
    category: "Getting Around",
    phrases: [
      { english: "Where is …?", translated: "…어디에 있어요?", pronunciation: "… eo-di-e iss-eo-yo?", tip: null },
      { english: "Subway station", translated: "지하철역이 어디예요?", pronunciation: "ji-ha-cheol-yeo-gi eo-di-ye-yo?", tip: null },
      { english: "Ticket", translated: "표 주세요", pronunciation: "pyo ju-se-yo", tip: null },
      { english: "Straight", translated: "직진", pronunciation: "jik-jin", tip: null },
      { english: "I’m lost", translated: "길을 잃었어요", pronunciation: "gi-reul ilh-eoss-eo-yo", tip: null },
    ],
  },
  {
    category: "Food & Ordering",
    phrases: [
      { english: "This, please", translated: "이거 주세요", pronunciation: "i-geo ju-se-yo", tip: "Point at picture menu." },
      { english: "Water", translated: "물 주세요", pronunciation: "mul ju-se-yo", tip: null },
      { english: "Not spicy", translated: "안 맵게 해주세요", pronunciation: "an maep-ge hae-ju-se-yo", tip: null },
      { english: "Delicious!", translated: "맛있어요!", pronunciation: "ma-siss-eo-yo!", tip: null },
      { english: "Bill", translated: "계산해 주세요", pronunciation: "gye-san-hae ju-se-yo", tip: null },
    ],
  },
  {
    category: "Shopping & Bargaining",
    phrases: [
      { english: "How much?", translated: "얼마예요?", pronunciation: "eol-ma-ye-yo?", tip: "Large stores: fixed price." },
      { english: "Too expensive", translated: "너무 비싸요", pronunciation: "neo-mu bi-ssa-yo", tip: null },
      { english: "Card OK?", translated: "카드 돼요?", pronunciation: "ka-deu dwae-yo?", tip: null },
      { english: "Receipt", translated: "영수증 주세요", pronunciation: "yeong-su-jeung ju-se-yo", tip: null },
    ],
  },
  {
    category: "Emergency & Health",
    phrases: [
      { english: "Help!", translated: "도와주세요!", pronunciation: "do-wa-ju-se-yo!", tip: "Police/Fire/Emergency: 112." },
      { english: "Hospital", translated: "병원이 어디예요?", pronunciation: "byeong-won-i eo-di-ye-yo?", tip: null },
      { english: "It hurts", translated: "아파요", pronunciation: "a-pa-yo", tip: null },
      { english: "Allergy", translated: "알레르기가 있어요", pronunciation: "al-le-reu-gi-ga iss-eo-yo", tip: null },
      { english: "Police", translated: "경찰", pronunciation: "gyeong-chal", tip: null },
    ],
  },
  {
    category: "Accommodation",
    phrases: [
      { english: "Reservation", translated: "예약했어요", pronunciation: "ye-yak-haess-eo-yo", tip: null },
      { english: "Room key", translated: "방 열쇠", pronunciation: "bang yeol-soe", tip: null },
      { english: "Wi‑Fi password?", translated: "Wi‑Fi 비밀번호가 뭐예요?", pronunciation: "WAI-fai bi-mil-beon-ho-ga mwo-ye-yo?", tip: null },
      { english: "Checkout time?", translated: "체크아웃 시간이 언제예요?", pronunciation: "che-keu a-ut si-ga-ni eon-je-ye-yo?", tip: null },
    ],
  },
  {
    category: "Numbers (1–10)",
    phrases: [
      { english: "One", translated: "하나", pronunciation: "ha-na", tip: null },
      { english: "Two", translated: "둘", pronunciation: "dul", tip: null },
      { english: "Three", translated: "셋", pronunciation: "set", tip: null },
      { english: "Four", translated: "넷", pronunciation: "net", tip: null },
      { english: "Five", translated: "다섯", pronunciation: "da-seot", tip: null },
      { english: "Six", translated: "여섯", pronunciation: "yeo-seot", tip: null },
      { english: "Seven", translated: "일곱", pronunciation: "il-gop", tip: null },
      { english: "Eight", translated: "여덟", pronunciation: "yeo-deol", tip: null },
      { english: "Nine", translated: "아홉", pronunciation: "a-hop", tip: null },
      { english: "Ten", translated: "열", pronunciation: "yeol", tip: null },
    ],
  },
  {
    category: "Polite Expressions",
    phrases: [
      { english: "Sorry", translated: "죄송합니다", pronunciation: "joe-song-ham-ni-da", tip: null },
      { english: "I don’t understand", translated: "이해가 안 돼요", pronunciation: "i-hae-ga an dwae-yo", tip: null },
      { english: "English?", translated: "영어 하세요?", pronunciation: "yeong-eo ha-se-yo?", tip: null },
      { english: "OK", translated: "네", pronunciation: "ne", tip: "Ne is yes / I see." },
      { english: "No", translated: "아니요", pronunciation: "a-ni-yo", tip: null },
    ],
  },
];
