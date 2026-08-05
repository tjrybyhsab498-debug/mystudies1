import { z } from "zod";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const SUMMARY_MODEL = "google/gemini-3.6-flash";

export const summarySchema = z.object({
  title: z.string(),
  overview: z.string(),
  key_points: z.array(z.object({ text: z.string(), page: z.number().nullable() })),
  terms: z.array(
    z.object({ term: z.string(), definition: z.string(), page: z.number().nullable() }),
  ),
  formulas: z.array(
    z.object({ name: z.string(), formula: z.string(), note: z.string().nullable(), page: z.number().nullable() }),
  ),
  dates: z.array(z.object({ date: z.string(), event: z.string(), page: z.number().nullable() })),
  comparisons: z.array(
    z.object({
      title: z.string(),
      label_a: z.string(),
      label_b: z.string(),
      rows: z.array(z.object({ aspect: z.string(), a: z.string(), b: z.string() })),
    }),
  ),
  likely_questions: z.array(z.object({ question: z.string(), answer: z.string() })),
});

export type SummaryContent = z.infer<typeof summarySchema>;

const SYSTEM_PROMPT = `أنت أستاذ جامعي خبير وملخّص أكاديمي فائق الدقة، تكتب بالعربية الفصحى المبسطة.
مهمتك: تحويل نص كتاب أو ملزمة إلى ملخص شمولي عميق دون فقدان أي معلومة جوهرية.
قواعد صارمة:
- لا تختلق أي معلومة غير موجودة في النص. إن لم تجد عنصراً اترك مصفوفته فارغة.
- النص يحتوي على علامات [صفحة N]. أرفق رقم الصفحة الصحيح مع كل بند (page). إن لم يكن الرقم واضحاً ضع null.
- استخرج: التعريفات والمصطلحات، القوانين والمعادلات، التواريخ والأحداث، جداول المقارنة، وأهم النقاط.
- اكتب overview كملخص مترابط (5-9 أسطر) لا مجرد قائمة.
- likely_questions: أهم الأسئلة المتوقعة في الامتحان مع إجابات مركزة.
- التزم بحد أقصى: 20 نقطة مفتاحية، 20 مصطلحاً، 15 معادلة، 15 تاريخاً، 4 جداول مقارنة، 10 أسئلة.`;

export type SummarizeArgs = {
  sourceText: string;
  pageFrom: number | null;
  pageTo: number | null;
  documentTitle: string;
};

export function buildUserPrompt({ sourceText, pageFrom, pageTo, documentTitle }: SummarizeArgs) {
  const range =
    pageFrom && pageTo ? `النطاق المطلوب: الصفحات ${pageFrom} إلى ${pageTo}.` : "النطاق: المادة كاملة.";
  return `عنوان الملف: ${documentTitle}\n${range}\n\n=== نص المادة ===\n${sourceText}`;
}

function clampArray<T>(items: T[] | undefined, max: number): T[] {
  return (items ?? []).slice(0, max);
}

export function normalizeSummary(raw: SummaryContent, fallbackTitle: string): SummaryContent {
  return {
    title: (raw.title || fallbackTitle).slice(0, 160),
    overview: (raw.overview || "").slice(0, 4000),
    key_points: clampArray(raw.key_points, 20),
    terms: clampArray(raw.terms, 20),
    formulas: clampArray(raw.formulas, 15),
    dates: clampArray(raw.dates, 15),
    comparisons: clampArray(raw.comparisons, 4),
    likely_questions: clampArray(raw.likely_questions, 10),
  };
}

export function toArabicGatewayError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("429")) return "الخدمة مشغولة حالياً (تجاوز حد الطلبات). حاول بعد قليل.";
  if (message.includes("402")) return "انتهى رصيد الذكاء الاصطناعي في مساحة العمل. يرجى إضافة رصيد.";
  if (message.includes("401") || message.includes("403")) return "تعذّر التحقق من مفتاح الذكاء الاصطناعي.";
  return "تعذّر توليد الملخص. حاول مرة أخرى أو قلّل نطاق الصفحات.";
}

/** يستدعي بوابة Lovable AI ببثّ مباشر ويعيد ملخصاً منظماً. */
export async function runSummaryModel(args: SummarizeArgs): Promise<SummaryContent> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is missing");

  const gateway = createLovableAiGatewayProvider(apiKey);

  try {
    const result = streamText({
      model: gateway(SUMMARY_MODEL),
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(args),
      output: Output.object({ schema: summarySchema }),
      maxRetries: 1,
    });
    const output = (await result.output) as SummaryContent;
    return normalizeSummary(output, args.documentTitle);
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("تعذّر تنسيق الملخص. حاول مرة أخرى بنطاق صفحات أصغر.");
    }
    throw error;
  }
}

/** تقطيع ذكي للنص مع الحفاظ على أرقام الصفحات، أساس البحث الدلالي (RAG). */
export function chunkSourceText(sourceText: string, maxChars = 3000) {
  const parts = sourceText.split(/\n?\[صفحة (\d+)\]\n?/);
  const chunks: { chunk_index: number; page_from: number | null; page_to: number | null; content: string }[] = [];

  let current = "";
  let startPage: number | null = null;
  let endPage: number | null = null;

  const flush = () => {
    const content = current.trim();
    if (content.length > 40) {
      chunks.push({
        chunk_index: chunks.length,
        page_from: startPage,
        page_to: endPage,
        content: content.slice(0, maxChars * 2),
      });
    }
    current = "";
    startPage = null;
    endPage = null;
  };

  for (let i = 1; i < parts.length; i += 2) {
    const page = Number(parts[i]);
    const text = (parts[i + 1] ?? "").trim();
    if (!text) continue;
    if (startPage === null) startPage = page;
    endPage = page;
    current += `${text}\n`;
    if (current.length >= maxChars) flush();
  }
  flush();
  return chunks.slice(0, 200);
}
