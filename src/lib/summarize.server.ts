import { z } from "zod";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { SummaryContent, SummaryDepth } from "./summary-types";

/** نموذج سريع قوي للتلخيص البسيط. */
export const SUMMARY_MODEL_STANDARD = "google/gemini-3.6-flash";
/** نموذج تفكير أقوى للتلخيص الشامل الوافي. */
export const SUMMARY_MODEL_DEEP = "google/gemini-3.1-pro-preview";

const pointSchema = z.object({ text: z.string(), page: z.number().nullable() });

export const summarySchema = z.object({
  title: z.string(),
  overview: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      page_from: z.number().nullable(),
      page_to: z.number().nullable(),
      intro: z.string().nullable(),
      points: z.array(pointSchema),
    }),
  ),
  key_points: z.array(pointSchema),
  terms: z.array(
    z.object({ term: z.string(), definition: z.string(), page: z.number().nullable() }),
  ),
  formulas: z.array(
    z.object({
      name: z.string(),
      formula: z.string(),
      note: z.string().nullable(),
      page: z.number().nullable(),
    }),
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

type RawSummary = z.infer<typeof summarySchema>;

const BASE_RULES = `أنت أستاذ جامعي خبير وملخّص أكاديمي فائق الدقة، تكتب بالعربية الفصحى المبسطة.
قواعد صارمة:
- لا تختلق أي معلومة غير موجودة في النص. إن لم تجد عنصراً اترك مصفوفته فارغة.
- النص يحتوي على علامات [صفحة N]. أرفق رقم الصفحة الصحيح مع كل بند (page). إن لم يتضح الرقم ضع null.
- **الترتيب إلزامي**: املأ sections بترتيب ورود المحتوى في النص من الأول إلى الآخر، عنواناً بعنوان، دون خلط أو تقديم وتأخير، ودون تكرار الفكرة في قسمين.
- كل قسم (section) = محور/عنوان فرعي حقيقي في المادة، مع intro سطر أو سطرين ثم points للأفكار الرئيسية والفرعية بالتراتب.
- استخرج أيضاً: التعريفات والمصطلحات، القوانين والمعادلات، التواريخ والأحداث، جداول المقارنة، والأسئلة المتوقعة.
- overview: ملخص مترابط لا مجرد قائمة.`;

const STANDARD_RULES = `${BASE_RULES}
مستوى التلخيص: **بسيط موسّع** — مركّز لكن غني بالتفاصيل (أطول بنحو 50% من الملخص المعتاد): اشرح كل نقطة بجملة كاملة مفيدة لا بكلمة واحدة.
حدود: overview من 8 إلى 12 سطراً، حتى 12 قسماً وكل قسم 3-7 نقاط، 30 نقطة مفتاحية، 30 مصطلحاً، 20 معادلة، 20 تاريخاً، 5 جداول، 15 سؤالاً.`;

const DEEP_RULES = `${BASE_RULES}
مستوى التلخيص: **شامل وافٍ (الأكثر تفصيلاً)** — لا تُسقِط لا صغيرة ولا كبيرة: غطِّ كل محاور النص وكل فكرة رئيسية وفرعية وكل مثال وكل استثناء وكل رقم، مع الحفاظ الكامل على التراتبية الهرمية والدقة العلمية.
اكتب بإسهاب: كل نقطة جملة أو جملتان مكتملتان، وأضف الأمثلة والتفريعات كنقاط منفصلة أسفل فكرتها.
حدود: حتى 25 قسماً وكل قسم حتى 15 نقطة، 60 نقطة مفتاحية، 60 مصطلحاً، 40 معادلة، 40 تاريخاً، 8 جداول، 25 سؤالاً. الأفضلية للتفصيل الكامل على الاختصار.`;

export type SummarizeArgs = {
  sourceText: string;
  pageFrom: number | null;
  pageTo: number | null;
  documentTitle: string;
  depth: SummaryDepth;
};

function buildUserPrompt(args: {
  sourceText: string;
  pageFrom: number | null;
  pageTo: number | null;
  documentTitle: string;
  partLabel?: string | undefined;
}) {
  const range =
    args.pageFrom && args.pageTo
      ? `النطاق المطلوب: الصفحات ${args.pageFrom} إلى ${args.pageTo}.`
      : "النطاق: المادة كاملة.";
  const part = args.partLabel ? `\n${args.partLabel}` : "";
  return `عنوان الملف: ${args.documentTitle}\n${range}${part}\n\n=== نص المادة ===\n${args.sourceText}`;
}

function clampArray<T>(items: T[] | undefined, max: number): T[] {
  return (items ?? []).slice(0, max);
}

const LIMITS = {
  standard: {
    sections: 12,
    sectionPoints: 8,
    key_points: 30,
    terms: 30,
    formulas: 20,
    dates: 20,
    comparisons: 5,
    questions: 15,
  },
  comprehensive: {
    sections: 40,
    sectionPoints: 16,
    key_points: 80,
    terms: 80,
    formulas: 50,
    dates: 50,
    comparisons: 10,
    questions: 30,
  },
} as const;

export function normalizeSummary(
  raw: RawSummary,
  fallbackTitle: string,
  depth: SummaryDepth,
): SummaryContent {
  const limits = LIMITS[depth];
  return {
    title: (raw.title || fallbackTitle).slice(0, 160),
    overview: (raw.overview || "").slice(0, 8000),
    sections: clampArray(raw.sections, limits.sections).map((section) => ({
      heading: section.heading.slice(0, 200),
      page_from: section.page_from ?? null,
      page_to: section.page_to ?? null,
      intro: section.intro ?? null,
      points: clampArray(section.points, limits.sectionPoints),
    })),
    key_points: clampArray(raw.key_points, limits.key_points),
    terms: clampArray(raw.terms, limits.terms),
    formulas: clampArray(raw.formulas, limits.formulas),
    dates: clampArray(raw.dates, limits.dates),
    comparisons: clampArray(raw.comparisons, limits.comparisons),
    likely_questions: clampArray(raw.likely_questions, limits.questions),
  };
}

export function toArabicGatewayError(error: unknown): string {
  const details: string[] = [];
  const statuses: number[] = [];
  const seen = new Set<unknown>();
  const inspect = (value: unknown, depth = 0) => {
    if (value == null || depth > 4 || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Error) details.push(value.message);
    else if (typeof value !== "object") details.push(String(value));
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const status = Number(record["statusCode"] ?? record["status"] ?? 0);
    if (Number.isFinite(status) && status > 0) statuses.push(status);
    inspect(record["cause"], depth + 1);
    inspect(record["lastError"], depth + 1);
    inspect(record["error"], depth + 1);
    const errors = record["errors"];
    if (Array.isArray(errors)) errors.forEach((item) => inspect(item, depth + 1));
  };
  inspect(error);
  const message = details.join(" ");
  if (statuses.includes(429) || message.includes("429"))
    return "الخدمة مشغولة حالياً (تجاوز حد الطلبات). حاول بعد قليل.";
  if (statuses.includes(402) || message.includes("402") || /payment required|credit|balance/i.test(message))
    return "انتهى رصيد الذكاء الاصطناعي في مساحة العمل. يرجى إضافة رصيد.";
  if (statuses.includes(401) || statuses.includes(403) || message.includes("401") || message.includes("403"))
    return "تعذّر التحقق من مفتاح الذكاء الاصطناعي.";
  if (message.startsWith("تعذّر") || message.startsWith("انتهى")) return message;
  return "تعذّر توليد الملخص. حاول مرة أخرى أو قلّل نطاق الصفحات.";
}

function isTerminalGatewayError(error: unknown): boolean {
  const record = error != null && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const status = Number(record?.["statusCode"] ?? record?.["status"] ?? 0);
  const message = error instanceof Error ? error.message : String(error);
  return (status >= 400 && status < 500) || /\b40[0-9]\b|payment required|credit|balance/i.test(message);
}

function getGateway() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is missing");
  return createLovableAiGatewayProvider(apiKey);
}

async function callModel(args: {
  model: string;
  system: string;
  prompt: string;
}): Promise<RawSummary> {
  const gateway = getGateway();
  try {
    const result = streamText({
      model: gateway(args.model),
      system: args.system,
      prompt: args.prompt,
      output: Output.object({ schema: summarySchema }),
      maxRetries: 0,
    });
    return (await result.output) as RawSummary;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("تعذّر تنسيق الملخص. حاول مرة أخرى بنطاق صفحات أصغر.");
    }
    throw error;
  }
}

/** يقسّم النص إلى أجزاء متسلسلة على حدود الصفحات للتلخيص الشامل. */
export function splitByPages(sourceText: string, maxChars: number): string[] {
  const markers = [...sourceText.matchAll(/\[صفحة \d+\]/g)];
  if (markers.length === 0) return [sourceText];

  const parts: string[] = [];
  let start = 0;
  let lastSafe = 0;
  for (const marker of markers) {
    const index = marker.index ?? 0;
    if (index - start > maxChars && lastSafe > start) {
      parts.push(sourceText.slice(start, lastSafe));
      start = lastSafe;
    }
    lastSafe = index;
  }
  parts.push(sourceText.slice(start));
  return parts.filter((part) => part.trim().length > 100);
}

function mergeSummaries(parts: RawSummary[], fallbackTitle: string): RawSummary {
  const seen = new Set<string>();
  const dedupe = <T>(items: T[], key: (item: T) => string) =>
    items.filter((item) => {
      const k = key(item).trim().toLowerCase();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  return {
    title: parts[0]?.title || fallbackTitle,
    overview: parts
      .map((p) => p.overview?.trim())
      .filter(Boolean)
      .join("\n\n"),
    sections: parts.flatMap((p) => p.sections ?? []),
    key_points: parts.flatMap((p) => p.key_points ?? []),
    terms: dedupe(
      parts.flatMap((p) => p.terms ?? []),
      (t) => `term:${t.term}`,
    ),
    formulas: dedupe(
      parts.flatMap((p) => p.formulas ?? []),
      (f) => `formula:${f.name}${f.formula}`,
    ),
    dates: dedupe(
      parts.flatMap((p) => p.dates ?? []),
      (d) => `date:${d.date}${d.event}`,
    ),
    comparisons: parts.flatMap((p) => p.comparisons ?? []),
    likely_questions: dedupe(
      parts.flatMap((p) => p.likely_questions ?? []),
      (q) => `q:${q.question}`,
    ),
  };
}

export function countWords(content: SummaryContent): number {
  const text = [
    content.overview,
    ...content.sections.flatMap((s) => [s.heading, s.intro ?? "", ...s.points.map((p) => p.text)]),
    ...content.key_points.map((p) => p.text),
    ...content.terms.map((t) => `${t.term} ${t.definition}`),
    ...content.likely_questions.map((q) => `${q.question} ${q.answer}`),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

/** يستدعي بوابة Lovable AI ويعيد ملخصاً منظماً ومرتباً. */
export async function runSummaryModel(
  args: SummarizeArgs & { onProgress?: (done: number, total: number) => void },
): Promise<SummaryContent> {
  if (args.depth === "standard") {
    const raw = await callModel({
      model: SUMMARY_MODEL_STANDARD,
      system: STANDARD_RULES,
      prompt: buildUserPrompt(args),
    });
    return normalizeSummary(raw, args.documentTitle, "standard");
  }

  // شامل وافٍ: أجزاء متسلسلة على حدود الصفحات، تُنفَّذ على دفعات محدودة التزامن،
  // وكل جزء له بديل أسرع. الفشل الجزئي لا يُلغي النتيجة كاملة.
  const segments = splitByPages(args.sourceText, 22_000).slice(0, 10);
  const total = segments.length;
  const results: (RawSummary | null)[] = new Array(total).fill(null);
  const CONCURRENCY = 2;
  let done = 0;

  const runSegment = async (index: number) => {
    const partLabel =
      total > 1
        ? `هذا الجزء ${index + 1} من ${total} من المادة. لخّصه كاملاً وبتراتبيته دون الإشارة لأجزاء أخرى.`
        : undefined;
    const prompt = buildUserPrompt({
      sourceText: segments[index]!,
      pageFrom: args.pageFrom,
      pageTo: args.pageTo,
      documentTitle: args.documentTitle,
      partLabel,
    });

    for (const model of [SUMMARY_MODEL_DEEP, SUMMARY_MODEL_STANDARD]) {
      try {
        results[index] = await callModel({ model, system: DEEP_RULES, prompt });
        break;
      } catch (error) {
        if (isTerminalGatewayError(error)) throw error;
        // نجرّب النموذج التالي؛ إن فشلت كل المحاولات نتجاوز هذا الجزء.
      }
    }
    done += 1;
    args.onProgress?.(done, total);
  };

  for (let start = 0; start < total; start += CONCURRENCY) {
    const batch: Promise<void>[] = [];
    for (let i = start; i < Math.min(start + CONCURRENCY, total); i += 1) batch.push(runSegment(i));
    await Promise.all(batch);
  }

  const ok = results.filter((r): r is RawSummary => r !== null);
  if (ok.length === 0) {
    throw new Error("تعذّر توليد الملخص الشامل. حاول بنطاق صفحات أصغر.");
  }
  return normalizeSummary(
    mergeSummaries(ok, args.documentTitle),
    args.documentTitle,
    "comprehensive",
  );
}


/** تقطيع ذكي للنص مع الحفاظ على أرقام الصفحات، أساس البحث الدلالي (RAG). */
export function chunkSourceText(sourceText: string, maxChars = 3000) {
  const parts = sourceText.split(/\n?\[صفحة (\d+)\]\n?/);
  const chunks: {
    chunk_index: number;
    page_from: number | null;
    page_to: number | null;
    content: string;
  }[] = [];

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
