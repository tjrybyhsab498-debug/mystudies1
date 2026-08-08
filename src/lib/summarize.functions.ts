import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseGenerateSummaryInput } from "@/lib/summary-inputs";

export const generateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(parseGenerateSummaryInput)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { chunkSourceText, countWords, runSummaryModel, toArabicGatewayError } =
      await import("@/lib/summarize.server");

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docError) throw new Error("تعذّر قراءة بيانات الملف");
    if (!doc) throw new Error("الملف غير موجود");

    // حد استخدام بسيط: 20 عملية تلخيص في الساعة لكل طالب.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("summaries")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if ((recentCount ?? 0) >= 20) {
      throw new Error("بلغت الحد الأقصى للتلخيص هذه الساعة. حاول بعد قليل.");
    }

    const pageFrom = data.pageFrom;
    const pageTo =
      data.pageTo && data.pageFrom && data.pageTo < data.pageFrom ? data.pageFrom : data.pageTo;

    const { data: row, error: insertError } = await supabase
      .from("summaries")
      .insert({
        user_id: userId,
        document_id: doc.id,
        feature: "summarize",
        depth: data.depth,
        page_from: pageFrom,
        page_to: pageTo,
        title: doc.title,
        status: "processing",
      })
      .select("id")
      .single();
    if (insertError || !row) throw new Error("تعذّر إنشاء الملخص");

    try {
      const content = await runSummaryModel({
        sourceText: data.sourceText,
        pageFrom,
        pageTo: pageTo ?? null,
        documentTitle: doc.title,
        depth: data.depth,
      });

      const { error: summaryUpdateError } = await supabase
        .from("summaries")
        .update({
          status: "ready",
          content,
          word_count: countWords(content),
          title: content.title || doc.title,
        })
        .eq("id", row.id);
      if (summaryUpdateError) throw new Error("تعذّر حفظ نتيجة الملخص");

      const chunks = chunkSourceText(data.sourceText).map((chunk) => ({
        ...chunk,
        user_id: userId,
        document_id: doc.id,
      }));
      if (chunks.length > 0) {
        const { error: deleteChunksError } = await supabase
          .from("document_chunks")
          .delete()
          .eq("document_id", doc.id);
        if (deleteChunksError) throw new Error("تعذّر تحديث فهرس الملف");
        const { error: insertChunksError } = await supabase.from("document_chunks").insert(chunks);
        if (insertChunksError) throw new Error("تعذّر فهرسة محتوى الملف");
      }

      return { summaryId: row.id as string };
    } catch (error) {
      console.error(`[AI feature failed] summary:${data.depth}`, error);
      const message = toArabicGatewayError(error);
      await supabase
        .from("summaries")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);
      throw new Error(message);
    }
  });
