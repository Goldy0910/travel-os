export type VisaInfo = {
  visaType: string;
  cost: string;
  costSourceLink: string;
  processingTime: string;
  applyLink: string;
};

export type TravelerType = "salaried" | "self-employed" | "student";

export type VisaProcessStep = {
  title: string;
  tip: string;
  link?: string | null;
};

export type VisaRecommendations = {
  beforeApply: string[];
  whileApplying: string[];
  afterApply: string[];
};

export type VisaGuide = {
  info: VisaInfo;
  checklistByType: Record<TravelerType, string[]>;
  recommendations: VisaRecommendations;
  steps: VisaProcessStep[];
  source: "ai-db" | "fallback";
};

export const fallbackVisaGuide: VisaGuide = {
  info: {
    visaType: "Check destination-specific visa guidance",
    cost: "Varies by destination",
    costSourceLink: "https://www.google.com/search?q=official+visa+fee+site%3Agov",
    processingTime: "Allow 2-4 weeks",
    applyLink: "https://www.google.com/search?q=official+evisa+application+site%3Agov",
  },
  checklistByType: {
    salaried: [
      "Passport",
      "Bank statement (6 months)",
      "Salary slips",
      "Leave letter",
      "Flight itinerary",
      "Hotel booking",
    ],
    "self-employed": [
      "Passport",
      "Business registration proof",
      "Bank statement (6 months)",
      "ITR acknowledgement",
      "Cover letter",
      "Flight itinerary",
      "Hotel booking",
    ],
    student: [
      "Passport",
      "Bonafide certificate",
      "Sponsor letter",
      "Bank statement (sponsor)",
      "College ID copy",
      "Flight itinerary",
      "Hotel booking",
    ],
  },
  recommendations: {
    beforeApply: [
      "Confirm passport validity (at least 6 months from travel date).",
      "Keep flight and hotel plans consistent with your visa form.",
      "Apply early to avoid peak-season delays.",
    ],
    whileApplying: [
      "Use clear, legible scans in requested file formats.",
      "Match names and passport numbers exactly across all documents.",
      "Track appointment and submission receipts carefully.",
    ],
    afterApply: [
      "Monitor official portal/email for status updates.",
      "Keep biometric and payment proofs handy.",
      "Do not book non-refundable plans until approval is issued.",
    ],
  },
  steps: [
    {
      title: "Fill application form",
      tip: "Complete details exactly as in passport and upload a recent photo.",
      link: "https://www.google.com/search?q=official+evisa+application+site%3Agov",
    },
    {
      title: "Upload documents",
      tip: "Use clear scans and include all mandatory supporting papers.",
      link: null,
    },
    {
      title: "Book appointment",
      tip: "Choose an early slot to keep buffer for reschedule if needed.",
      link: null,
    },
    {
      title: "Attend biometrics",
      tip: "Carry originals and appointment confirmation.",
      link: null,
    },
    {
      title: "Wait for approval",
      tip: "Track status periodically and follow any clarification requests quickly.",
      link: null,
    },
  ],
  source: "fallback",
};

export const defaultChecklistByTravelerType: Record<TravelerType, string[]> = {
  salaried: [
    "Passport",
    "Bank statement (6 months)",
    "Salary slips",
    "Leave letter",
    "Flight itinerary",
    "Hotel booking",
  ],
  "self-employed": [
    "Passport",
    "Business registration proof",
    "Bank statement (6 months)",
    "ITR acknowledgement",
    "Cover letter",
    "Flight itinerary",
  ],
  student: [
    "Passport",
    "Bonafide certificate",
    "Sponsor letter",
    "Bank statement (sponsor)",
    "College ID copy",
    "Flight itinerary",
  ],
};
