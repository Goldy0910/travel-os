export type VisaBadgeType = "Visa-free" | "Visa on arrival" | "eVisa" | "Visa required";

export type VisaLookupResponse = {
  visaType: VisaBadgeType;
  processingTime: string;
  processingDays: number;
  fee: string;
  validity: string;
  maxStay: string;
  applyLink: string;
  guideSteps: string[];
  documents: string[];
};

export type VisaAlertSeverity = "ok" | "note" | "warning";

export type VisaAlert = {
  title: string;
  detail: string;
  severity: VisaAlertSeverity;
};

export type VisaAlertsResponse = {
  alerts: VisaAlert[];
  refreshedAtIso: string;
};

export type TripVisa2Option = {
  id: string;
  title: string;
  destination: string;
  destinationCountry: string;
  flagEmoji: string;
  startDate: string;
  endDate: string;
};
