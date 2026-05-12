export type LocalAppCategory = "Transport" | "Food" | "Payments" | "Navigation";

export type LocalAppItem = {
  id: string;
  name: string;
  category: LocalAppCategory;
  rating: number;
  shortTips: string[];
  fullTips: string[];
  playStoreUrl: string;
  appStoreUrl: string;
  lastUpdatedIso: string;
  mostUseful?: boolean;
};

export type LocalCityApps = {
  city: string;
  country: string;
  mustHave: string[];
  categories: Record<LocalAppCategory, LocalAppItem[]>;
  lastUpdatedIso: string;
};

export type LocalAppsTripOption = {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
};
