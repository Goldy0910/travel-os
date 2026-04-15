"use client";

import { createBrowserClient } from "@supabase/auth-helpers-nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** v0.15+ auth-helpers: use createBrowserClient (createClientComponentClient was consolidated into @supabase/ssr). */
function useSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return useMemo(() => {
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return createBrowserClient(url, key);
  }, [url, key]);
}

/** Infer primary spoken language from destination text (cities & regions). */
function detectLanguage(destination: string): string {
  const raw = destination.toLowerCase().trim();
  if (!raw) return "English";
  const d = ` ${raw.replace(/[^\p{L}\p{N}\s,-]/gu, " ").replace(/\s+/g, " ")} `;

  const hasAny = (terms: readonly string[]) => terms.some((term) => d.includes(` ${term} `));

  // India-first: city/state level destinations should resolve to the local most-used travel language.
  if (
    hasAny([
      "manali",
      "shimla",
      "dharamshala",
      "kullu",
      "himachal",
      "new delhi",
      "delhi",
      "mumbai",
      "agra",
      "jaipur",
      "goa",
      "varanasi",
      "rishikesh",
      "haridwar",
      "mussoorie",
      "udaipur",
      "jodhpur",
      "amritsar",
      "india",
      "bharat",
    ])
  ) {
    return "Hindi";
  }
  if (hasAny(["tamil nadu", "chennai", "madurai", "coimbatore", "pondicherry"])) return "Tamil";
  if (hasAny(["telangana", "hyderabad", "andhra pradesh", "vijayawada", "visakhapatnam", "vizag"]))
    return "Telugu";
  if (hasAny(["kerala", "kochi", "ernakulam", "thiruvananthapuram", "trivandrum", "kozhikode", "calicut"]))
    return "Malayalam";
  if (hasAny(["karnataka", "bengaluru", "bangalore", "mysuru", "mangalore"])) return "Kannada";
  if (hasAny(["west bengal", "kolkata", "howrah", "darjeeling"])) return "Bengali";
  if (hasAny(["maharashtra", "pune", "nagpur", "nashik"])) return "Marathi";
  if (hasAny(["gujarat", "ahmedabad", "surat", "vadodara", "rajkot"])) return "Gujarati";
  if (hasAny(["punjab", "ludhiana", "jalandhar", "patiala"])) return "Punjabi";
  if (hasAny(["odisha", "orissa", "bhubaneswar", "puri", "cuttack"])) return "Odia";

  if (hasAny(["japan", "tokyo", "osaka", "kyoto", "sapporo", "hokkaido"])) return "Japanese";
  if (hasAny(["france", "paris", "lyon", "nice", "marseille"])) return "French";
  if (hasAny(["spain", "madrid", "barcelona", "seville", "valencia"])) return "Spanish";
  if (hasAny(["germany", "berlin", "munich", "hamburg", "frankfurt"])) return "German";
  if (hasAny(["italy", "rome", "milan", "florence", "venice"])) return "Italian";
  if (hasAny(["china", "beijing", "shanghai", "guangzhou", "shenzhen"])) return "Chinese";
  if (hasAny(["south korea", "korea", "seoul", "busan", "incheon"])) return "Korean";
  if (hasAny(["thailand", "bangkok", "phuket", "chiang mai", "krabi"])) return "Thai";
  if (hasAny(["uae", "united arab emirates", "dubai", "abu dhabi", "sharjah", "qatar", "doha", "saudi", "kuwait", "oman"]))
    return "Arabic";
  if (hasAny(["vietnam", "hanoi", "ho chi minh", "saigon", "da nang"])) return "Vietnamese";
  if (hasAny(["indonesia", "bali", "jakarta", "yogyakarta", "surabaya"])) return "Indonesian";
  if (hasAny(["portugal", "lisbon", "porto", "brazil", "rio de janeiro", "sao paulo"])) return "Portuguese";
  if (hasAny(["russia", "moscow", "saint petersburg"])) return "Russian";
  if (hasAny(["turkey", "istanbul", "ankara", "izmir"])) return "Turkish";
  if (hasAny(["greece", "athens", "santorini", "mykonos"])) return "Greek";
  if (hasAny(["netherlands", "amsterdam", "rotterdam", "the hague"])) return "Dutch";

  return "English";
}

const CULTURAL_TIPS: Record<string, string[]> = {
  Japanese: [
    "Bow slightly when greeting — a deeper bow shows more respect.",
    "Remove shoes when entering homes and many traditional restaurants.",
    "Tipping is uncommon and can feel awkward; excellent service is the norm without extra.",
    "Keep voice levels low on trains and in quiet public spaces.",
    "Offer and receive cards or small items with both hands.",
  ],
  French: [
    "Start interactions with “Bonjour” before a question — it’s expected in shops and cafés.",
    "Mealtimes are social; lunch can run long and some kitchens pause mid-afternoon.",
    "Dress a notch smarter than casual for dining out in cities.",
    "A small round-up for service is appreciated; it’s not as rigid as in the US.",
    "Learning a few French phrases is noticed and appreciated.",
  ],
  Spanish: [
    "Greetings and good-byes matter — “Hola” and “Gracias” go a long way.",
    "Lunch is often the largest meal; dinner may start late compared to northern Europe.",
    "Personal space can be closer than in some cultures — don’t step back abruptly.",
    "Siesta culture varies by region; check opening hours outside big cities.",
    "Tipping is modest; rounding up or small change is common.",
  ],
  German: [
    "Be punctual for meetings and reservations — timekeeping signals respect.",
    "Quiet Sundays and nights: avoid loud activities in residential areas.",
    "Cash is still common; carry some euros even if you use cards.",
    "Direct speech is normal — it’s often clarity, not rudeness.",
    "Recycle and sort waste where bins are labeled.",
  ],
  Italian: [
    "Greet with “Buongiorno” / “Buonasera” before ordering or asking for help.",
    "Coffee at the bar is quick; lingering table service is a different ritual.",
    "Cover shoulders/knees in many churches.",
    "Dinner often starts after 20:00 in cities — plan accordingly.",
    "A small coperto or service charge may appear on the bill.",
  ],
  Chinese: [
    "Address elders and hosts with polite titles when possible.",
    "At meals, wait for the host to start or invite you before digging in.",
    "Gift-giving has nuances — avoid clocks or sharp objects as gifts in many contexts.",
    "Queuing norms vary; stay calm and follow local flow in transit hubs.",
    "WeChat Pay / Alipay dominate; carry a backup payment method as a visitor.",
  ],
  Korean: [
    "Two-hand gestures when pouring drinks or passing items to elders show respect.",
    "Remove shoes indoors where you see a shoe rack or step-up entry.",
    "Keep subway voices low; designated seats are for those who need them.",
    "Tipping is not expected in most restaurants.",
    "Learn “Annyeonghaseyo” and “Gamsahamnida” — they’re used constantly.",
  ],
  Thai: [
    "Avoid touching anyone’s head — it’s considered the most sacred part of the body.",
    "Remove shoes at temples and many homes; dress modestly at religious sites.",
    "The monarchy is deeply respected — avoid jokes or casual criticism.",
    "Smile often — calm, friendly tone resolves many small misunderstandings.",
    "Use the “wai” greeting where locals do, especially with elders.",
  ],
  Hindi: [
    "“Namaste” with palms together is a widely understood respectful greeting.",
    "Use the right hand for eating and handing objects when sharing from common dishes.",
    "Dress modestly at temples and in rural areas; cover shoulders and knees.",
    "Bargaining is normal in markets — stay good-humored and fair.",
    "Remove footwear where you see others doing so at doorways.",
  ],
  Arabic: [
    "Dress modestly in public — shoulders and knees covered in many places.",
    "During Ramadan, avoid eating, drinking, or smoking in public during daylight in Muslim-majority areas.",
    "Use the right hand for eating and passing food.",
    "Public displays of affection are often discouraged.",
    "Learn “As-salamu alaykum” and “Shukran” — they’re warmly received.",
  ],
  Vietnamese: [
    "Greet with a slight bow or nod; a handshake is fine in cities.",
    "Remove shoes when entering homes.",
    "Street food is central — choose busy stalls with high turnover.",
    "Negotiate calmly in markets; a smile helps.",
    "Dress modestly at pagodas; cover shoulders and legs.",
  ],
  Indonesian: [
    "Use the right hand for giving, receiving, and eating in many social settings.",
    "Dress modestly outside resort beaches; sarongs are often available at temples.",
    "“Terima kasih” and a smile go far in daily interactions.",
    "Respect temple rules — quiet voices, no climbing on shrines.",
    "Bargain politely in markets; agree with a handshake or nod when done.",
  ],
  Portuguese: [
    "Greetings are warm — expect cheek kisses among friends in Portugal/Brazil varies.",
    "Meal times can run late; restaurants may open for dinner after 20:00.",
    "Tipping is modest; check if service is included.",
    "Queue politely; personal space is closer than in some northern cultures.",
    "Learn “Obrigado/Obrigada” — gender agreement matters.",
  ],
  Russian: [
    "Remove shoes in homes when hosts do; slippers may be offered.",
    "Bring a small gift when visiting someone’s home — flowers in odd numbers (except 13).",
    "Avoid whistling indoors in some folk traditions.",
    "Be punctual for formal invites; social events may start flexibly.",
    "Learn “Spasibo” and “Zdravstvuyte” for daily use.",
  ],
  Turkish: [
    "Remove shoes in homes and some traditional spaces when invited.",
    "Tea (“çay”) offers are social — accepting is often polite.",
    "Dress modestly at mosques; women may need a head covering.",
    "Bargaining in bazaars is expected — stay friendly.",
    "A small tip in restaurants is appreciated though not always required.",
  ],
  Greek: [
    "Lunch can be late; many tavernas peak after 21:00 in summer.",
    "“Yassas” for hello/goodbye is useful.",
    "Dress modestly in monasteries — long skirts/trousers for visitors of any gender where required.",
    "Tipping ~5–10% or round up in casual dining.",
    "Avoid raised voices in sacred or quiet historic sites.",
  ],
  Dutch: [
    "Cyclists have priority — don’t walk in bike lanes.",
    "Punctuality matters for appointments; social dinners may be looser.",
    "Direct feedback is common — it’s usually efficiency, not rudeness.",
    "Cashless is normal; carry a card.",
    "“Dank je” / “Alstublieft” are everyday essentials.",
  ],
  Tamil: [
    "Remove footwear at temples and many homes.",
    "Right hand preferred for prasad and offerings at temples.",
    "Dress modestly at religious sites; cover shoulders and legs.",
    "Learn “Vanakkam” — it’s widely appreciated.",
    "Ask before photographing people at festivals or ceremonies.",
  ],
  Telugu: [
    "Remove shoes at temples and some homes.",
    "Cover shoulders and legs at major temples.",
    "“Namaskaram” is a respectful greeting.",
    "Vegetarian norms are strong in many areas — check before offering food.",
    "Bargaining is common in local markets — stay respectful.",
  ],
};

const EMERGENCY_LINES: Record<string, string[]> = {
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

const DEFAULT_EMERGENCY = [
  "If in the EU: 112 (police / ambulance / fire).",
  "If in doubt, ask your hotel or host for the local emergency number.",
  "Save your embassy contact before you travel.",
  "ICE: add an “In Case of Emergency” contact in your phone.",
];

function getCulturalTips(language: string): string[] {
  return (
    CULTURAL_TIPS[language] ?? [
      "Learn a few local phrases — effort is almost always appreciated.",
      "Watch how locals queue, tip, and greet — mirror when unsure.",
      "Ask permission before photographing people or ceremonies.",
      "Keep calm when plans change — flexibility is part of travel.",
    ]
  );
}

function getEmergencyLines(language: string): string[] {
  return EMERGENCY_LINES[language] ?? DEFAULT_EMERGENCY;
}

type PhraseRow = {
  english: string;
  translated: string;
  pronunciation: string;
  tip: string | null;
};

type PhraseCategory = { category: string; phrases: PhraseRow[] };

type TranslationResult = {
  translated?: string;
  pronunciation?: string | null;
  back_translation?: string;
  error?: string;
};

type MenuItem = { original?: string; translated?: string; price?: string | null; category?: string };

type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { results: Array<{ 0: { transcript: string } }> }) => void) | null;
};

type WebSpeechRecognitionCtor = new () => WebSpeechRecognition;

type Props = {
  tripId: string;
  tripTitle: string;
  destination: string;
};

export default function LanguageClient({ tripId, tripTitle, destination }: Props) {
  const supabase = useSupabaseBrowser();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, [supabase]);

  const language = detectLanguage(destination);

  const [view, setView] = useState<"translate" | "phrasebook" | "camera" | "tips">("translate");

  const [inputText, setInputText] = useState("");
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [phrasebook, setPhrasebook] = useState<PhraseCategory[]>([]);
  const [phrasebookLoaded, setPhrasebookLoaded] = useState(false);
  const [isLoadingPhrases, setIsLoadingPhrases] = useState(false);
  const [phrasebookSource, setPhrasebookSource] = useState<"static" | "generated_cached" | "generated" | "error" | null>(
    null,
  );
  const [activeCategory, setActiveCategory] = useState(0);

  const [cameraResult, setCameraResult] = useState<MenuItem[]>([]);
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  /** No `capture` — mobile OS shows gallery / files (and often camera as an extra choice). */
  const menuGalleryInputRef = useRef<HTMLInputElement>(null);
  /** `capture` — opens the camera directly for a new photo. */
  const menuCameraInputRef = useRef<HTMLInputElement>(null);

  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadPhrasebook = useCallback(async () => {
    setIsLoadingPhrases(true);
    try {
      const res = await fetch("/api/phrasebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language, destination }),
      });
      const data = (await res.json()) as {
        categories?: PhraseCategory[];
        source?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error || "Phrasebook failed");
        setPhrasebook([]);
        setPhrasebookSource("error");
        return;
      }
      const cats = Array.isArray(data.categories) ? data.categories : [];
      setPhrasebook(cats);
      setPhrasebookSource(
        data.source === "static" || data.source === "generated_cached" || data.source === "generated"
          ? data.source
          : cats.length > 0
            ? "generated"
            : "error",
      );
    } catch {
      toast.error("Could not load phrasebook.");
      setPhrasebook([]);
      setPhrasebookSource("error");
    } finally {
      setIsLoadingPhrases(false);
      setPhrasebookLoaded(true);
    }
  }, [language, destination]);

  useEffect(() => {
    void loadPhrasebook();
  }, [loadPhrasebook]);

  useEffect(() => {
    if (activeCategory >= phrasebook.length) setActiveCategory(0);
  }, [phrasebook.length, activeCategory]);

  async function translateText() {
    if (!inputText.trim()) return;
    setIsTranslating(true);
    setTranslationResult(null);
    try {
      const res = await fetch("/api/translate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          targetLanguage: language,
          sourceLanguage: "English",
        }),
      });
      const data = (await res.json()) as TranslationResult;
      if (!res.ok) {
        toast.error(data.error || "Translation failed");
        setTranslationResult(null);
        return;
      }
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setTranslationResult(data);
    } catch {
      toast.error("Translation request failed.");
    } finally {
      setIsTranslating(false);
    }
  }

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingKey(null);
  }, []);

  async function speakText(text: string, key: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (speakingKey === key) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    setSpeakingKey(key);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, language }),
      });
      const data = (await res.json()) as { audio?: string; error?: string };
      if (!res.ok || !data.audio) {
        toast.error(data.error || "Could not play audio.");
        setSpeakingKey(null);
        return;
      }
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      audioRef.current = audio;
      audio.onended = () => {
        audioRef.current = null;
        setSpeakingKey(null);
      };
      audio.onerror = () => {
        toast.error("Audio playback failed.");
        setSpeakingKey(null);
      };
      await audio.play();
    } catch {
      toast.error("Speech request failed.");
      setSpeakingKey(null);
    }
  }

  function startListening() {
    const w = window as unknown as {
      SpeechRecognition?: WebSpeechRecognitionCtor;
      webkitSpeechRecognition?: WebSpeechRecognitionCtor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn’t supported in this browser. Try Chrome or Edge.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Microphone error — check permissions.");
    };
    recognition.onresult = (event: { results: Array<{ 0: { transcript: string } }> }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInputText(transcript);
    };
    recognition.start();
  }

  async function handleCameraUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanningCamera(true);
    setCameraResult([]);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = reader.result as string;
        const m = /^data:([^;]+);base64,(.+)$/.exec(result);
        const base64 = m?.[2]?.trim() || result.split(",")[1]?.trim() || "";
        if (!base64) {
          toast.error("Could not read image.");
          setIsScanningCamera(false);
          return;
        }
        const res = await fetch("/api/translate-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            targetLanguage: "English",
          }),
        });
        const data = (await res.json()) as { items?: MenuItem[]; error?: string };
        if (!res.ok) {
          toast.error(data.error || "Menu scan failed.");
          setCameraResult([]);
          return;
        }
        setCameraResult(Array.isArray(data.items) ? data.items : []);
      } catch {
        toast.error("Upload failed.");
        setCameraResult([]);
      } finally {
        setIsScanningCamera(false);
      }
    };
    reader.onerror = () => {
      toast.error("Could not read file.");
      setIsScanningCamera(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const culturalTips = getCulturalTips(language);
  const emergencyLines = getEmergencyLines(language);

  return (
    <div className="min-h-0 bg-[#f4f4f0] pb-8" data-trip-id={tripId}>
      <div className="mx-auto flex max-w-[390px] flex-col gap-4 px-4 py-3">
        <p className="sr-only">
          {tripTitle} — language helper for {destination}
        </p>

        <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <span className="text-2xl" aria-hidden>
            🌍
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-indigo-900">{destination || "Trip"}</p>
            <p className="text-xs text-indigo-600">Language focus: {language}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              { key: "translate", label: "Translate" },
              { key: "phrasebook", label: "Phrasebook" },
              { key: "camera", label: "Camera" },
              { key: "tips", label: "Tips" },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`touch-manipulation rounded-lg py-2.5 text-center text-[11px] font-medium leading-tight transition-all sm:text-xs ${
                view === v.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === "translate" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                English → {language}
              </p>
              <div className="relative">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type what you want to say…"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 pb-10 text-sm text-gray-900"
                />
                <button
                  type="button"
                  onClick={startListening}
                  className={`absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg shadow-sm ${
                    isListening ? "animate-pulse border-red-200 text-red-500" : "text-gray-600"
                  }`}
                  aria-label="Voice input"
                >
                  🎤
                </button>
              </div>
              {isListening && (
                <p className="text-center text-xs text-red-500">Listening… speak now</p>
              )}
              <button
                type="button"
                onClick={() => void translateText()}
                disabled={isTranslating || !inputText.trim()}
                className="min-h-11 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {isTranslating ? "Translating…" : "Translate"}
              </button>
            </div>

            {translationResult?.translated && (
              <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs text-gray-400">In {language}</p>
                    <p className="text-lg font-medium text-gray-900">{translationResult.translated}</p>
                    {translationResult.pronunciation != null && translationResult.pronunciation !== "" && (
                      <p className="mt-1 text-sm text-indigo-600">{translationResult.pronunciation}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void speakText(translationResult.translated!, "translate-main")}
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm ${
                      speakingKey === "translate-main"
                        ? "border-indigo-300 bg-indigo-100"
                        : "border-gray-200 bg-white"
                    }`}
                    aria-label="Play pronunciation"
                  >
                    {speakingKey === "translate-main" ? "⏹" : "▶"}
                  </button>
                </div>
                {translationResult.back_translation && (
                  <p className="border-t border-gray-100 pt-2 text-xs text-gray-500">
                    Back-translation: “{translationResult.back_translation}”
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {view === "phrasebook" && (
          <div className="flex flex-col gap-3">
            {!phrasebookLoaded || isLoadingPhrases ? (
              <div className="rounded-xl border border-gray-100 bg-white py-14 text-center text-sm text-gray-400">
                <p className="mb-2 text-2xl">📖</p>
                <p>Loading phrasebook…</p>
              </div>
            ) : phrasebook.length === 0 ? (
              <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-sm text-gray-500">
                No phrases yet. Check your connection or try again later.
              </div>
            ) : (
              <>
                {phrasebookSource === "static" ? (
                  <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-center text-[11px] leading-snug text-emerald-900">
                    Using built-in phrasebook for {language} — no AI generation. Audio still uses TTS when you tap play
                    (cached after first play).
                  </p>
                ) : null}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-webkit-overflow-scrolling:touch]">
                  {phrasebook.map((cat, i) => (
                    <button
                      key={`${cat.category}-${i}`}
                      type="button"
                      onClick={() => setActiveCategory(i)}
                      className={`shrink-0 touch-manipulation rounded-full border px-3 py-2 text-xs font-medium transition-all ${
                        activeCategory === i
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      {cat.category}
                    </button>
                  ))}
                </div>

                {phrasebook[activeCategory] && (
                  <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                    {phrasebook[activeCategory].phrases.map((phrase, i) => {
                      const sid = `pb-${activeCategory}-${i}`;
                      return (
                        <div
                          key={`${phrase.english}-${i}`}
                          className="border-b border-gray-50 p-4 last:border-b-0"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900">{phrase.english}</p>
                              <p className="mt-1 text-base text-indigo-700">{phrase.translated}</p>
                              <p className="mt-0.5 text-xs text-gray-500">{phrase.pronunciation}</p>
                              {phrase.tip && (
                                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                                  {phrase.tip}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => void speakText(phrase.translated, sid)}
                              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border text-xs ${
                                speakingKey === sid
                                  ? "border-indigo-300 bg-indigo-100"
                                  : "border-gray-200 bg-white"
                              }`}
                              aria-label="Play phrase"
                            >
                              {speakingKey === sid ? "⏹" : "▶"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === "camera" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 text-center">
              <p className="text-3xl" aria-hidden>
                📷
              </p>
              <p className="text-sm font-medium text-gray-800">Scan a menu, sign, or label</p>
              <p className="text-xs text-gray-500">
                We’ll read the image and translate visible items to English.
              </p>
              <input
                ref={menuGalleryInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleCameraUpload(e)}
                className="hidden"
                aria-hidden
              />
              <input
                ref={menuCameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void handleCameraUpload(e)}
                className="hidden"
                aria-hidden
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => menuGalleryInputRef.current?.click()}
                  disabled={isScanningCamera}
                  className="min-h-11 touch-manipulation rounded-xl border-2 border-indigo-200 bg-white py-2.5 text-xs font-semibold text-indigo-800 disabled:opacity-50 sm:text-sm"
                >
                  🖼️ Gallery
                </button>
                <button
                  type="button"
                  onClick={() => menuCameraInputRef.current?.click()}
                  disabled={isScanningCamera}
                  className="min-h-11 touch-manipulation rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50 sm:text-sm"
                >
                  {isScanningCamera ? "Scanning…" : "📷 Camera"}
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                Gallery: existing photos. Camera: take a new picture.
              </p>
            </div>

            {cameraResult.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {cameraResult.length} item{cameraResult.length === 1 ? "" : "s"}
                  </span>
                </div>
                {cameraResult.map((item, i) => (
                  <div key={i} className="border-b border-gray-50 px-4 py-3 last:border-b-0">
                    <p className="text-sm font-medium text-gray-900">{item.translated}</p>
                    {item.original && (
                      <p className="mt-0.5 text-xs text-gray-400">{item.original}</p>
                    )}
                    {item.price && (
                      <p className="mt-1 text-xs font-medium text-green-700">{item.price}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "tips" && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-900">
                  Cultural etiquette — {language}
                </p>
                <p className="mt-0.5 text-xs text-amber-800">{destination}</p>
              </div>
              {culturalTips.map((tip, i) => (
                <div key={i} className="flex gap-3 border-b border-gray-50 px-4 py-3 last:border-b-0">
                  <span className="flex-shrink-0 text-sm font-semibold text-indigo-500">{i + 1}.</span>
                  <p className="text-sm leading-relaxed text-gray-700">{tip}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                Emergency &amp; safety
              </p>
              <ul className="space-y-2 text-sm text-gray-700">
                {emergencyLines.map((line, i) => (
                  <li key={i} className="border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-gray-400">
                Numbers vary by country — verify with your hotel or official tourism site.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
