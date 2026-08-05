export type SummaryContent = {
  title: string;
  overview: string;
  key_points: { text: string; page: number | null }[];
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
