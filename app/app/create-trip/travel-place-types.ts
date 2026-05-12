export type TravelPlaceDTO = {
  slug: string;
  primary_label: string;
  subtitle: string | null;
  visa_note: string | null;
  tags: string[];
  icon_key: string;
  sort_order: number;
  canonical_location: string;
};
