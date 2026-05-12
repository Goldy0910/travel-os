export type PhraseRow = {
  english: string;
  translated: string;
  pronunciation: string;
  tip: string | null;
};

export type PhraseCategory = {
  category: string;
  phrases: PhraseRow[];
};
