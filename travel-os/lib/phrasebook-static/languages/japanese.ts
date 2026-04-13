import type { PhraseCategory } from "../types";

export const japanesePhrasebook: PhraseCategory[] = [
  {
    category: "Greetings",
    phrases: [
      { english: "Hello", translated: "こんにちは", pronunciation: "kon-ni-CHI-wa", tip: "Use ohayō in morning, konbanwa in evening." },
      { english: "Thank you", translated: "ありがとうございます", pronunciation: "a-ri-ga-tō go-ZAI-masu", tip: "Arigatō alone is casual." },
      { english: "Excuse me", translated: "すみません", pronunciation: "su-mi-MA-sen", tip: "Also used to get attention in shops." },
      { english: "Nice to meet you", translated: "はじめまして", pronunciation: "ha-ji-ME-ma-shi-te", tip: "Follow with your name + desu." },
      { english: "Goodbye", translated: "さようなら", pronunciation: "sa-yō-NA-ra", tip: "Often use またね (mata ne) with friends." },
    ],
  },
  {
    category: "Getting Around",
    phrases: [
      { english: "Where is …?", translated: "…はどこですか？", pronunciation: "… wa DO-ko des-ka?", tip: null },
      { english: "Train station", translated: "駅はどこですか？", pronunciation: "E-ki wa DO-ko des-ka?", tip: null },
      { english: "Ticket", translated: "切符をください", pronunciation: "KI-ppu o ku-da-sai", tip: null },
      { english: "This way?", translated: "この方向でいいですか？", pronunciation: "ko-no Hō-kō de ii des-ka?", tip: null },
      { english: "I’m lost", translated: "道に迷いました", pronunciation: "mi-chi ni ma-yoi-MA-shi-ta", tip: null },
    ],
  },
  {
    category: "Food & Ordering",
    phrases: [
      { english: "I’ll have this", translated: "これをください", pronunciation: "KO-re o ku-da-sai", tip: "Point at menu or display food." },
      { english: "Water", translated: "お水をください", pronunciation: "o-MI-zu o ku-da-sai", tip: null },
      { english: "No meat", translated: "肉なしでお願いします", pronunciation: "ni-ku NA-shi de o-ne-gai shi-masu", tip: null },
      { english: "Delicious!", translated: "おいしいです", pronunciation: "oi-SHII des", tip: null },
      { english: "Check, please", translated: "お会計お願いします", pronunciation: "o-KAI-kei o-ne-gai shi-masu", tip: null },
    ],
  },
  {
    category: "Shopping & Bargaining",
    phrases: [
      { english: "How much?", translated: "いくらですか？", pronunciation: "i-KU-ra des-ka?", tip: "Fixed prices in most chain stores." },
      { english: "Tax included?", translated: "税込みですか？", pronunciation: "ZEI-komi des-ka?", tip: null },
      { english: "Bag, please", translated: "袋をください", pronunciation: "fu-ku-ro o ku-da-sai", tip: "Bring a reusable bag; some shops charge." },
      { english: "I’m just looking", translated: "見ているだけです", pronunciation: "mi-te-i-ru DA-ke des", tip: null },
    ],
  },
  {
    category: "Emergency & Health",
    phrases: [
      { english: "Help!", translated: "助けて！", pronunciation: "TA-ske-te!", tip: "Police: 110, Ambulance/Fire: 119." },
      { english: "Hospital", translated: "病院はどこですか？", pronunciation: "BYŌ-in wa DO-ko des-ka?", tip: null },
      { english: "I’m allergic to …", translated: "…アレルギーがあります", pronunciation: "… a-RU-ru-gii ga a-ri-masu", tip: null },
      { english: "It hurts here", translated: "ここが痛いです", pronunciation: "KO-ko ga i-tai des", tip: null },
      { english: "Police box", translated: "交番はどこですか？", pronunciation: "KŌ-ban wa DO-ko des-ka?", tip: "Kōban are small local police posts." },
    ],
  },
  {
    category: "Accommodation",
    phrases: [
      { english: "Check-in", translated: "チェックインお願いします", pronunciation: "CHE-kku in o-ne-gai shi-masu", tip: null },
      { english: "Room key", translated: "部屋の鍵をください", pronunciation: "he-ya no ka-gi o ku-da-sai", tip: null },
      { english: "Wi‑Fi?", translated: "Wi‑Fiのパスワードは？", pronunciation: "WAI-fai no PASU-wā-do wa?", tip: null },
      { english: "Towel", translated: "タオルをください", pronunciation: "TA-o-ru o ku-da-sai", tip: null },
    ],
  },
  {
    category: "Numbers (1–10)",
    phrases: [
      { english: "One", translated: "いち", pronunciation: "i-chi", tip: null },
      { english: "Two", translated: "に", pronunciation: "ni", tip: null },
      { english: "Three", translated: "さん", pronunciation: "san", tip: null },
      { english: "Four", translated: "よん", pronunciation: "yon", tip: null },
      { english: "Five", translated: "ご", pronunciation: "go", tip: null },
      { english: "Six", translated: "ろく", pronunciation: "roku", tip: null },
      { english: "Seven", translated: "なな", pronunciation: "na-na", tip: null },
      { english: "Eight", translated: "はち", pronunciation: "ha-chi", tip: null },
      { english: "Nine", translated: "きゅう", pronunciation: "kyū", tip: null },
      { english: "Ten", translated: "じゅう", pronunciation: "jū", tip: null },
    ],
  },
  {
    category: "Polite Expressions",
    phrases: [
      { english: "Please", translated: "お願いします", pronunciation: "o-ne-GAI shi-masu", tip: null },
      { english: "I don’t understand", translated: "わかりません", pronunciation: "wa-ka-ri-MA-sen", tip: null },
      { english: "English OK?", translated: "英語でいいですか？", pronunciation: "E-go de ii des-ka?", tip: null },
      { english: "Sorry", translated: "ごめんなさい", pronunciation: "go-men-na-sai", tip: "More casual than sumimasen for apologies." },
      { english: "OK / Yes", translated: "はい", pronunciation: "hai", tip: "Hai can mean ‘yes’ or ‘I hear you’." },
    ],
  },
];
