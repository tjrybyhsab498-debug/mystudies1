import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { askTutor } from "@/lib/study.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tutor")({
  head: () => ({
    meta: [
      { title: "الأستاذ الرقمي — دراستي AI" },
      {
        name: "description",
        content: "معلم خصوصي بالذكاء الاصطناعي يذاكر معك بالطريقة السقراطية على ملفاتك.",
      },
      { property: "og:title", content: "الأستاذ الرقمي — دراستي AI" },
      { property: "og:description", content: "حوار العباقرة: اسأل، أجب، وتعلّم خطوة بخطوة." },
    ],
  }),
  component: TutorPage,
});

type Message = { role: "user" | "assistant"; content: string };

function TutorPage() {
  const queryClient = useQueryClient();
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: documents } = useQuery({
    queryKey: ["documents"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: history } = useQuery({
    queryKey: ["tutor-messages", documentId],
    queryFn: async () => {
      const query = supabase
        .from("tutor_messages")
        .select("role, content, created_at")
        .order("created_at", { ascending: true })
        .limit(60);
      const { data } = await (documentId
        ? query.eq("document_id", documentId)
        : query.is("document_id", null));
      return (data ?? []).map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));
    },
  });

  const messages: Message[] = [...(history ?? []), ...local];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, busy]);

  useEffect(() => {
    setLocal([]);
  }, [documentId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (question.length < 2 || busy) return;
    setInput("");
    setLocal((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);
    try {
      const result = await askTutor({ data: { documentId, question } });
      setLocal((prev) => [...prev, { role: "assistant", content: result.answer }]);
      await queryClient.invalidateQueries({ queryKey: ["tutor-messages", documentId] });
      setLocal([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الوصول إلى الأستاذ الرقمي");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="الأستاذ الرقمي" subtitle="معلمك الخصوصي الذكي">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDocumentId(null)}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
            documentId === null
              ? "border-primary bg-primary-soft text-primary"
              : "border-border bg-card text-muted-foreground",
          )}
        >
          حوار عام
        </button>
        {(documents ?? []).map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => setDocumentId(doc.id)}
            className={cn(
              "max-w-[45%] truncate rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
              documentId === doc.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {doc.title}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <BrainCircuit className="size-6" />
            </span>
            <h2 className="mt-3 text-sm font-bold text-foreground">ابدأ حوار العباقرة</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              اختر ملفاً من الأعلى واسأل عن أي فكرة فيه. سيشرح لك الأستاذ بإيجاز ثم يسألك سؤالاً
              ليقيس فهمك — مع الإشارة إلى رقم الصفحة.
            </p>
          </div>
        ) : (
          messages.map((message, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[88%] whitespace-pre-wrap rounded-2xl p-3 text-sm leading-relaxed shadow-soft",
                message.role === "user"
                  ? "ms-auto bg-primary text-primary-foreground"
                  : "me-auto border border-border bg-card text-foreground",
              )}
            >
              {message.content}
            </div>
          ))
        )}
        {busy ? (
          <div className="me-auto flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            الأستاذ يفكّر…
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-2 mt-4 flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب سؤالك…"
          maxLength={2000}
          className="bg-card"
        />
        <Button type="submit" size="icon" aria-label="إرسال" disabled={busy || input.trim().length < 2}>
          <Send className="size-4" />
        </Button>
      </form>
    </AppShell>
  );
}
