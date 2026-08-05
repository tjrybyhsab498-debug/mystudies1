import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, Mic } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

export const Route = createFileRoute("/_authenticated/tutor")({
  head: () => ({
    meta: [
      { title: "الأستاذ الرقمي — دراستي AI" },
      {
        name: "description",
        content: "معلم خصوصي بالذكاء الاصطناعي يذاكر معك بالطريقة السقراطية نصاً وصوتاً.",
      },
      { property: "og:title", content: "الأستاذ الرقمي — دراستي AI" },
      { property: "og:description", content: "حوار العباقرة: اسأل، أجب، وتعلّم خطوة بخطوة." },
    ],
  }),
  component: TutorPage,
});

function TutorPage() {
  return (
    <AppShell title="الأستاذ الرقمي" subtitle="معلمك الخصوصي الذكي">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <BrainCircuit className="size-7" />
        </span>
        <h2 className="mt-4 text-base font-bold text-foreground">حوار العباقرة — قريباً</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          سيذاكر معك الأستاذ الرقمي بالطريقة السقراطية: أسئلة متدرجة، تصحيح فوري، وشرح مبسّط ومشجّع
          — مبني على ملفاتك التي رفعتها.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-border bg-secondary p-4">
        <Mic className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-secondary-foreground">
          المُحاور الصوتي المباشر سيتيح لك مناقشة الدروس شفهياً دون كتابة — ضمن المرحلة القادمة.
        </p>
      </div>
    </AppShell>
  );
}
