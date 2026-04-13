import type { PhraseCategory } from "../types";

/** Mandarin (Simplified); useful across mainland China and many travelers. */
export const chinesePhrasebook: PhraseCategory[] = [
  {
    category: "Greetings",
    phrases: [
      { english: "Hello", translated: "你好", pronunciation: "nǐ hǎo", tip: "您好 (nín hǎo) is more polite." },
      { english: "Thank you", translated: "谢谢", pronunciation: "xièxie", tip: null },
      { english: "Excuse me", translated: "不好意思", pronunciation: "bù hǎo yìsi", tip: "Also used before a request." },
      { english: "Goodbye", translated: "再见", pronunciation: "zàijiàn", tip: null },
      { english: "Nice to meet you", translated: "很高兴认识你", pronunciation: "hěn gāoxìng rènshi nǐ", tip: null },
    ],
  },
  {
    category: "Getting Around",
    phrases: [
      { english: "Where is …?", translated: "…在哪里？", pronunciation: "… zài nǎlǐ?", tip: null },
      { english: "Subway", translated: "地铁站在哪里？", pronunciation: "dìtiě zhàn zài nǎlǐ?", tip: null },
      { english: "Ticket", translated: "买票", pronunciation: "mǎi piào", tip: null },
      { english: "Turn right / left", translated: "右转 / 左转", pronunciation: "yòu zhuǎn / zuǒ zhuǎn", tip: null },
      { english: "I’m lost", translated: "我迷路了", pronunciation: "wǒ mílù le", tip: null },
    ],
  },
  {
    category: "Food & Ordering",
    phrases: [
      { english: "I want this", translated: "我要这个", pronunciation: "wǒ yào zhège", tip: "Point at menu or picture." },
      { english: "Water", translated: "水", pronunciation: "shuǐ", tip: "矿泉水 bottled mineral water." },
      { english: "Not spicy", translated: "不要辣", pronunciation: "bù yào là", tip: null },
      { english: "Bill", translated: "买单", pronunciation: "mǎidān", tip: "结账 also common." },
      { english: "Delicious", translated: "好吃", pronunciation: "hǎochī", tip: null },
    ],
  },
  {
    category: "Shopping & Bargaining",
    phrases: [
      { english: "How much?", translated: "多少钱？", pronunciation: "duōshao qián?", tip: "Markets may bargain; malls fixed." },
      { english: "Too expensive", translated: "太贵了", pronunciation: "tài guì le", tip: null },
      { english: "Cheaper?", translated: "便宜一点？", pronunciation: "piányi yīdiǎn?", tip: null },
      { english: "I’ll take it", translated: "我要了", pronunciation: "wǒ yào le", tip: null },
    ],
  },
  {
    category: "Emergency & Health",
    phrases: [
      { english: "Help!", translated: "救命！", pronunciation: "jiùmìng!", tip: "Police 110, Ambulance 120, Fire 119 (mainland)." },
      { english: "Hospital", translated: "医院在哪里？", pronunciation: "yīyuàn zài nǎlǐ?", tip: null },
      { english: "I’m allergic to …", translated: "我对…过敏", pronunciation: "wǒ duì … guòmǐn", tip: null },
      { english: "It hurts", translated: "疼", pronunciation: "téng", tip: null },
      { english: "Police", translated: "警察", pronunciation: "jǐngchá", tip: null },
    ],
  },
  {
    category: "Accommodation",
    phrases: [
      { english: "Check-in", translated: "入住", pronunciation: "rùzhù", tip: null },
      { english: "Room key", translated: "房卡", pronunciation: "fángkǎ", tip: null },
      { english: "Wi‑Fi password?", translated: "Wi‑Fi密码是什么？", pronunciation: "WIFI mìmǎ shì shénme?", tip: null },
      { english: "Checkout time", translated: "几点退房？", pronunciation: "jǐ diǎn tuìfáng?", tip: null },
    ],
  },
  {
    category: "Numbers (1–10)",
    phrases: [
      { english: "One", translated: "一", pronunciation: "yī", tip: null },
      { english: "Two", translated: "二", pronunciation: "èr", tip: "两 liǎng used with measure words often." },
      { english: "Three", translated: "三", pronunciation: "sān", tip: null },
      { english: "Four", translated: "四", pronunciation: "sì", tip: null },
      { english: "Five", translated: "五", pronunciation: "wǔ", tip: null },
      { english: "Six", translated: "六", pronunciation: "liù", tip: null },
      { english: "Seven", translated: "七", pronunciation: "qī", tip: null },
      { english: "Eight", translated: "八", pronunciation: "bā", tip: null },
      { english: "Nine", translated: "九", pronunciation: "jiǔ", tip: null },
      { english: "Ten", translated: "十", pronunciation: "shí", tip: null },
    ],
  },
  {
    category: "Polite Expressions",
    phrases: [
      { english: "Sorry", translated: "对不起", pronunciation: "duìbuqǐ", tip: null },
      { english: "I don’t understand", translated: "我听不懂", pronunciation: "wǒ tīng bu dǒng", tip: null },
      { english: "Do you speak English?", translated: "你会说英语吗？", pronunciation: "nǐ huì shuō Yīngyǔ ma?", tip: null },
      { english: "OK", translated: "好的", pronunciation: "hǎo de", tip: null },
      { english: "No", translated: "不", pronunciation: "bù", tip: null },
    ],
  },
];
