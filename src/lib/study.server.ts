import { z } from "zod";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const STUDY_MODEL = "google/gemini-3.6-flash";

function gateway() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is missing");
  return createLovableAiGatewayProvider(apiKey);
}

export const flashcardsSchema = z.object({
  title: z.string(),
  cards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
      page: z.number().nullable(),
    }),
  ),
});

export const quizSchema = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      kind: z.enum(["mcq", "truefalse"]),
      question: z.string(),
      options: z.array(z.string()),
      correct_index: z.number(),
      explanation: z.string(),
      page: z.number().nullable(),
    }),
  ),
});

export type FlashcardsResult = z.infer<typeof flashcardsSchema>;
export type QuizResult = z.infer<typeof quizSchema>;

async function structured<T>(args: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  try {
    const result = streamText({
      model: gateway()(STUDY_MODEL),
      system: args.system,
      prompt: args.prompt,
      output: Output.object({ schema: args.schema as never }),
      maxRetries: 1,
    });
    return (await result.output) as T;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("تعذّر تنسيق النتيجة. حاول مرة أخرى بنطاق أصغر.");
    }
    throw error;
  }
}

export async function runFlashcardsModel(args: {
  sourceText: string;
  documentTitle: string;
  count: number;
}): Promise<FlashcardsResult> {
  const raw = await structured({
    schema: flashcardsSchema,
    system: `أنت معلم خبير يصنع بطاقات مذاكرة (Flashcards) بالعربية الفصحى المبسطة.
- الوجه (front): سؤال أو مصطلح قصير واضح. الظهر (back): إجابة دقيقة مركزة (سطر إلى ثلاثة).
- استخرج فقط ما في النص، ولا تختلق. أرفق رقم الصفحة من علامات [صفحة N] أو null.
- رتّب البطاقات بترتيب ورودها في المادة، وابدأ بالأهم مفاهيمياً في كل قسم.`,
    prompt: `عنوان الملف: ${args.documentTitle}\nالمطلوب: ${args.count} بطاقة كحد أقصى.\n\n=== نص المادة ===\n${args.sourceText}`,
  });
  return { title: raw.title || args.documentTitle, cards: raw.cards.slice(0, args.count) };
}

export async function runQuizModel(args: {
  sourceText: string;
  documentTitle: string;
  count: number;
}): Promise<QuizResult> {
  const raw = await structured({
    schema: quizSchema,
    system: `أنت واضع أسئلة امتحانات محترف بالعربية الفصحى المبسطة.
- ولّد أسئلة اختيار من متعدد (4 خيارات) وأسئلة صح/خطأ (خيارَان: "صح" ثم "خطأ").
- correct_index هو فهرس الإجابة الصحيحة داخل options ويبدأ من 0.
- explanation: تفسير قصير للإجابة الصحيحة. page: رقم الصفحة من علامات [صفحة N] أو null.
- لا تختلق معلومة خارج النص، وتجنّب الأسئلة المكررة أو الغامضة.`,
    prompt: `عنوان الملف: ${args.documentTitle}\nالمطلوب: ${args.count} سؤالاً كحد أقصى (أغلبها اختيار من متعدد).\n\n=== نص المادة ===\n${args.sourceText}`,
  });

  const questions = raw.questions
    .filter((q) => q.options.length >= 2 && q.correct_index >= 0 && q.correct_index < q.options.length)
    .slice(0, args.count);
  return { title: raw.title || args.documentTitle, questions };
}

export const TUTOR_SYSTEM = `أنت "الأستاذ الرقمي" في تطبيق دراستي AI: معلم خصوصي عربي بارع يذاكر بالطريقة السقراطية.
- اعتمد أولاً على المقتطفات المرفقة من ملف الطالب، وأشر لرقم الصفحة عند الاستناد إليها.
- لا تُعطِ الإجابة كاملة فوراً: اشرح بإيجاز ثم اطرح سؤالاً واحداً متدرج الصعوبة يقيس الفهم.
- صحّح خطأ الطالب بلطف وشجّعه، واستخدم أمثلة مبسطة.
- إن كان السؤال خارج الملف فأجب من معرفتك العامة ونبّه بلطف أنه خارج المادة.
- ردود قصيرة (3-7 أسطر) وبالعربية الفصحى المبسطة دائماً.`;

/** بحث كلمي بسيط داخل مقاطع الملف لبناء سياق (RAG خفيف بدون متجهات). */
export function pickRelevantChunks(
  chunks: { content: string; page_from: number | null }[],
  question: string,
  max = 5,
): string {
  const words = question
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = chunks.map((chunk) => {
    const text = chunk.content;
    let score = 0;
    for (const word of words) if (text.includes(word)) score += 1;
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const picked = scored.slice(0, max).filter((s, i) => s.score > 0 || i < 2);
  return picked
    .map((s) => `[صفحة ${s.chunk.page_from ?? "?"}]\n${s.chunk.content.slice(0, 1800)}`)
    .join("\n---\n");
}

export async function runTutorModel(args: {
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
}): Promise<string> {
  const result = streamText({
    model: gateway()(STUDY_MODEL),
    system: TUTOR_SYSTEM,
    messages: [
      ...(args.context
        ? ([
            {
              role: "user" as const,
              content: `مقتطفات من ملف الطالب للاستناد إليها:\n${args.context}`,
            },
            { role: "assistant" as const, content: "تمام، سأعتمد على هذه المقتطفات." },
          ] as const)
        : []),
      ...args.history.slice(-10),
      { role: "user" as const, content: args.question },
    ],
    maxRetries: 1,
  });
  return await result.text;
}
