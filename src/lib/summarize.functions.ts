import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkSourceText, runSummaryModel, toArabicGatewayError } from "@/lib/summarize.server";

const generateSummaryInput = z.object({
  documentId: z.string().uuid(),
  pageFrom: z.number().int().min(1).max(10_000).nullable(),
  pageTo: z.number().int().min(1).max(10_000).nullable(),
  sourceText: z.string().trim().min(200).max(150_000),
});

export const generateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateSummaryInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, title")
      .eq("id", data.documentId)
      .maybeSingle();
    if (docError) throw new Error("تعذّر قراءة بيانات الملف");
    if (!doc) throw new Error("الملف غير موجود");

    const pageFrom = data.pageFrom;
    const pageTo =
      data.pageTo && data.pageFrom && data.pageTo < data.pageFrom ? data.pageFrom : data.pageTo;

    const { data: row, error: insertError } = await supabase
      .from("summaries")
      .insert({
        user_id: userId,
        document_id: doc.id,
        feature: "summarize",
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
      });

      await supabase
        .from("summaries")
        .update({ status: "ready", content, title: content.title || doc.title })
        .eq("id", row.id);

      const chunks = chunkSourceText(data.sourceText).map((chunk) => ({
        ...chunk,
        user_id: userId,
        document_id: doc.id,
      }));
      if (chunks.length > 0) {
        await supabase.from("document_chunks").delete().eq("document_id", doc.id);
        await supabase.from("document_chunks").insert(chunks);
      }

      return { summaryId: row.id as string };
    } catch (error) {
      const message = toArabicGatewayError(error);
      await supabase
        .from("summaries")
        .update({ status: "failed", error_message: message })
        .eq("id", row.id);
      throw new Error(message);
    }
  });
