import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useRef, useState } from "react";
import { FileText, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FeatureSheet, type FeatureRunConfig } from "@/components/library/feature-sheet";
import { getFeature } from "@/lib/features";
import { buildSourceText, extractPdfText } from "@/lib/pdf-text";
import { generateSummary } from "@/lib/summarize.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  feature: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_authenticated/library")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "مكتبتي — دراستي AI" },
      { name: "description", content: "المستودع السحابي: ارفع ملفات PDF وملازمك وزامنها بين أجهزتك." },
      { property: "og:title", content: "مكتبتي — دراستي AI" },
      { property: "og:description", content: "كل ملازمك وملخصاتك محفوظة بأمان في مكان واحد." },
    ],
  }),
  component: LibraryPage,
});

const MAX_SIZE = 20 * 1024 * 1024;
const PDF_SIGNATURE = "%PDF";

type DocumentRow = {
  id: string;
  title: string;
  storage_path: string;
  file_size: number | null;
  page_count: number | null;
  created_at: string;
};

function LibraryPage() {
  const { feature: featureId } = Route.useSearch();
  const navigate = useNavigate({ from: "/library" });
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const activeFeature = getFeature(featureId);
  const pickMode = Boolean(activeFeature);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, storage_path, file_size, page_count, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentRow[];
    },
  });

  const { data: summaries } = useQuery({
    queryKey: ["summaries"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("summaries")
        .select("id, title, status, page_from, page_to, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const clearFeature = () => navigate({ search: { feature: "" } });

  const runFeature = useMutation({
    mutationFn: async ({ doc, config }: { doc: DocumentRow; config: FeatureRunConfig }) => {
      setProgress("جارٍ تنزيل الملف…");
      const { data: file, error } = await supabase.storage
        .from("study-files")
        .download(doc.storage_path);
      if (error || !file) throw new Error("تعذّر تنزيل الملف من المستودع");

      const buffer = await file.arrayBuffer();
      setProgress("جارٍ استخراج النص من الصفحات…");
      const { pages } = await extractPdfText(buffer, {
        pageFrom: config.pageFrom,
        pageTo: config.pageTo,
        onProgress: (done, total) => setProgress(`استخراج النص: ${done} / ${total} صفحة`),
      });

      const sourceText = buildSourceText(pages);
      if (sourceText.length < 200) {
        throw new Error("لم يُعثر على نص قابل للقراءة في هذا النطاق (قد يكون الملف صوراً ممسوحة).");
      }

      setProgress("الذكاء الاصطناعي يحلل المادة ويكتب الملخص…");
      const result = await generateSummary({
        data: {
          documentId: doc.id,
          pageFrom: config.pageFrom,
          pageTo: config.pageTo,
          sourceText,
        },
      });
      return result.summaryId;
    },
    onSuccess: async (summaryId) => {
      setProgress(null);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["summaries"] });
      clearFeature();
      toast.success("تم توليد الكبسولة الذكية");
      navigate({ to: "/summary/$id", params: { id: summaryId } });
    },
    onError: (error) => {
      setProgress(null);
      toast.error(error instanceof Error ? error.message : "تعذّر تنفيذ الميزة");
    },
  });

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("الرجاء اختيار ملف PDF");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("حجم الملف يجب أن يكون أقل من 20 ميجابايت");
      return;
    }

    setUploading(true);
    try {
      const head = new TextDecoder().decode(new Uint8Array(await file.slice(0, 5).arrayBuffer()));
      if (!head.startsWith(PDF_SIGNATURE)) {
        throw new Error("الملف ليس PDF صالحاً");
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("الجلسة منتهية");

      const path = `${userId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("study-files")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        user_id: userId,
        title: file.name.replace(/\.pdf$/i, "").slice(0, 160),
        storage_path: path,
        file_size: file.size,
      });
      if (insertError) throw insertError;

      toast.success("تم رفع الملف إلى مستودعك السحابي");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      await queryClient.invalidateQueries({ queryKey: ["documents-count"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر رفع الملف");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (doc: DocumentRow) => {
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("تعذّر حذف الملف");
      return;
    }
    await supabase.storage.from("study-files").remove([doc.storage_path]);
    toast.success("تم حذف الملف");
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    await queryClient.invalidateQueries({ queryKey: ["documents-count"] });
    await queryClient.invalidateQueries({ queryKey: ["summaries"] });
  };

  return (
    <AppShell title="مكتبتي" subtitle="المستودع السحابي لملازمك وكتبك">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />

      {activeFeature ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary">
            <activeFeature.icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">{activeFeature.title}</p>
            <p className="mt-0.5 text-xs text-primary/80">{activeFeature.pickerHint}</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="إلغاء الوضع" onClick={clearFeature}>
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <Button
        size="lg"
        className="w-full gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        رفع ملف PDF جديد
      </Button>

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </>
        ) : documents && documents.length > 0 ? (
          documents.map((doc) => (
            <article
              key={doc.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-right transition-transform active:scale-[0.98]"
                onClick={() => {
                  if (!pickMode) {
                    toast("اختر ميزة من الرئيسية لتطبيقها على هذا الملف");
                    return;
                  }
                  setSelected(doc);
                }}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <FileText className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">{doc.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} م.ب` : "PDF"}
                    {" · "}
                    {new Date(doc.created_at).toLocaleDateString("ar-EG")}
                  </span>
                </span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="حذف"
                onClick={() => remove(doc)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <FileText className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">مكتبتك فارغة</p>
            <p className="mt-1 text-xs text-muted-foreground">
              ارفع أول ملزمة لك لتبدأ التلخيص الذكي.
            </p>
          </div>
        )}
      </div>

      {summaries && summaries.length > 0 ? (
        <>
          <h2 className="mt-7 text-base font-bold text-foreground">كبسولاتي الذكية</h2>
          <div className="mt-3 space-y-2">
            {summaries.map((summary) => (
              <Link
                key={summary.id}
                to="/summary/$id"
                params={{ id: summary.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Sparkles className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {summary.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {summary.page_from && summary.page_to
                      ? `صفحات ${summary.page_from}–${summary.page_to}`
                      : "المادة كاملة"}
                    {summary.status !== "ready" ? " · لم يكتمل" : ""}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <FeatureSheet
        feature={activeFeature}
        documentTitle={selected?.title}
        open={Boolean(selected)}
        busy={runFeature.isPending}
        progress={progress}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSubmit={(config) => {
          if (!selected) return;
          runFeature.mutate({ doc: selected, config });
        }}
      />
    </AppShell>
  );
}
