export type SummaryPoint = { text: string; page: number | null };

export type SummarySection = {
  heading: string;
  page_from: number | null;
  page_to: number | null;
  intro: string | null;
  points: SummaryPoint[];
};

export type SummaryContent = {
  title: string;
  overview: string;
  sections: SummarySection[];
  key_points: SummaryPoint[];
  terms: { term: string; definition: string; page: number | null }[];
  formulas: { name: string; formula: string; note: string | null; page: number | null }[];
  dates: { date: string; event: string; page: number | null }[];
  comparisons: {
    title: string;
    label_a: string;
    label_b: string;
    rows: { aspect: string; a: string; b: string }[];
  }[];
  likely_questions: { question: string; answer: string }[];
};

export type SummaryDepth = "standard" | "comprehensive";
