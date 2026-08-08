import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseStudySourceInput, parseTutorInput } from "@/lib/study-inputs";

export const generateFlashcards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseStudySourceInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { runFlashcardsModel } = await import("@/lib/study.server");
    const { toArabicGatewayError } = await import("@/lib/summarize.server");

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docError) throw new Error("تعذّر قراءة بيانات الملف");
    if (!doc) throw new Error("الملف غير موجود");

    try {
      const result = await runFlashcardsModel({
        sourceText: data.sourceText,
        documentTitle: doc.title,
        count: data.count,
      });

      const { data: deck, error: deckError } = await supabase
        .from("flashcard_decks")
        .insert({
          user_id: userId,
          document_id: doc.id,
          title: result.title || doc.title,
          page_from: data.pageFrom,
          page_to: data.pageTo,
          card_count: result.cards.length,
        })
        .select("id")
        .single();
      if (deckError || !deck) throw new Error("تعذّر حفظ مجموعة البطاقات");

      const rows = result.cards.map((card, index) => ({
        user_id: userId,
        deck_id: deck.id,
        position: index,
        front: card.front.slice(0, 500),
        back: card.back.slice(0, 2000),
        page: card.page,
      }));
      if (rows.length > 0) {
        const { error: cardsError } = await supabase.from("flashcards").insert(rows);
        if (cardsError) {
          await supabase.from("flashcard_decks").delete().eq("id", deck.id);
          throw new Error("تعذّر حفظ البطاقات");
        }
      }

      return { deckId: deck.id as string, count: rows.length };
    } catch (error) {
      console.error("[AI feature failed] flashcards", error);
      throw new Error(toArabicGatewayError(error));
    }
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseStudySourceInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { runQuizModel } = await import("@/lib/study.server");
    const { toArabicGatewayError } = await import("@/lib/summarize.server");

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docError) throw new Error("تعذّر قراءة بيانات الملف");
    if (!doc) throw new Error("الملف غير موجود");

    try {
      const result = await runQuizModel({
        sourceText: data.sourceText,
        documentTitle: doc.title,
        count: data.count,
      });
      if (result.questions.length === 0) throw new Error("تعذّر توليد أسئلة من هذا النطاق.");

      const { data: quiz, error } = await supabase
        .from("quizzes")
        .insert({
          user_id: userId,
          document_id: doc.id,
          title: result.title || doc.title,
          page_from: data.pageFrom,
          page_to: data.pageTo,
          questions: result.questions,
        })
        .select("id")
        .single();
      if (error || !quiz) throw new Error("تعذّر حفظ الاختبار");

      return { quizId: quiz.id as string, count: result.questions.length };
    } catch (error) {
      console.error("[AI feature failed] quiz", error);
      throw new Error(toArabicGatewayError(error));
    }
  });

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseTutorInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { pickRelevantChunks, runTutorModel } = await import("@/lib/study.server");
    const { toArabicGatewayError } = await import("@/lib/summarize.server");

    let contextText = "";
    if (data.documentId) {
      const { data: chunks, error: chunksError } = await supabase
        .from("document_chunks")
        .select("content, page_from")
        .eq("document_id", data.documentId)
        .order("chunk_index", { ascending: true })
        .limit(120);
      if (chunksError) throw new Error("تعذّر قراءة مقاطع الملف");
      if (chunks && chunks.length > 0) contextText = pickRelevantChunks(chunks, data.question);
    }

    const historyQuery = supabase
      .from("tutor_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(10);
    const { data: history } = await (data.documentId
      ? historyQuery.eq("document_id", data.documentId)
      : historyQuery.is("document_id", null));

    const ordered = (history ?? [])
      .reverse()
      .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content }));

    try {
      const answer = await runTutorModel({
        context: contextText,
        history: ordered,
        question: data.question,
      });

      const { error: userMessageError } = await supabase.from("tutor_messages").insert({
        user_id: userId,
        document_id: data.documentId,
        role: "user",
        content: data.question,
      });
      if (userMessageError) throw new Error("تعذّر حفظ سؤالك");

      const { error: assistantMessageError } = await supabase.from("tutor_messages").insert({
        user_id: userId,
        document_id: data.documentId,
        role: "assistant",
        content: answer,
      });
      if (assistantMessageError) throw new Error("وصل الرد لكن تعذّر حفظه");

      return { answer };
    } catch (error) {
      console.error("[AI feature failed] tutor", error);
      throw new Error(toArabicGatewayError(error));
    }
  });
