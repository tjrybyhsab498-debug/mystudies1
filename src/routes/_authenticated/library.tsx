import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/library")({
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

function LibraryPage() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, file_path, file_size, page_count, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
        title: file.name.replace(/\.pdf$/i, ""),
        file_path: path,
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

  const remove = async (id: string, filePath: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast.error("تعذّر حذف الملف");
      return;
    }
    await supabase.storage.from("study-files").remove([filePath]);
    toast.success("تم حذف الملف");
    await queryClient.invalidateQueries({ queryKey: ["documents"] });
    await queryClient.invalidateQueries({ queryKey: ["documents-count"] });
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
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : documents && documents.length > 0 ? (
          documents.map((doc) => (
            <article
              key={doc.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-foreground">{doc.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} م.ب` : "PDF"}
                  {" · "}
                  {new Date(doc.created_at).toLocaleDateString("ar-EG")}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="حذف"
                onClick={() => remove(doc.id, doc.file_path)}
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
    </AppShell>
  );
}
