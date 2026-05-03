export type VisaTypeId = "e-visa" | "embassy-sticker-visa" | "visa-on-arrival" | "visa-free";

export type VisaAlertSeverity = "ok" | "note" | "warning";

export type VisaAlert = {
  title: string;
  detail: string;
  severity: VisaAlertSeverity;
};

export type VisaDocumentDetail = {
  name: string;
  format: string;
  requirement: string;
  tip: string;
};

export type VisaTypeOption = {
  id: VisaTypeId;
  label: string;
  description: string;
  processingTime: string;
  processingDays: number;
  feeInr: string;
  feeNote: string;
  validity: string;
  maxStay: string;
  applyLink: string;
  guideSteps: string[];
  documents: VisaDocumentDetail[];
};

export type VisaRejectionGuide = {
  reasons: string[];
  immediateAction: string;
  timeline: string;
  reassurance: string;
};

export type VisaLookupResponse = {
  visaOptions: VisaTypeOption[];
  rejectionGuide: VisaRejectionGuide;
};

export type VisaAlertsResponse = {
  alerts: VisaAlert[];
  refreshedAtIso: string;
};

export type TripVisa3Option = {
  id: string;
  title: string;
  destination: string;
  destinationCountry: string;
  flagEmoji: string;
  startDate: string;
  endDate: string;
};
