import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ListChecks, RotateCcw, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/quiz/$id")({
  head: () => ({
    meta: [
      { title: "الاختبار المحاكي — دراستي AI" },
      {
        name: "description",
        content: "امتحان تفاعلي مولّد من ملفك مع تصحيح فوري وتفسير لكل سؤال.",
      },
      { property: "og:title", content: "الاختبار المحاكي — دراستي AI" },
      { property: "og:description", content: "اختبر نفسك قبل الامتحان الحقيقي." },
    ],
  }),
  component: QuizPage,
});

type Question = {
  kind: "mcq" | "truefalse";
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  page: number | null;
};

function QuizPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => {
      const { data: quiz } = await supabase
        .from("quizzes")
        .select("id, title, questions")
        .eq("id", id)
        .maybeSingle();
      return quiz;
    },
  });

  const questions = (data?.questions as unknown as Question[] | null) ?? [];
  const score = questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
    0,
  );

  const finish = async () => {
    setFinished(true);
    void supabase
      .from("quizzes")
      .update({ score, taken_at: new Date().toISOString() })
      .eq("id", id);
  };

  return (
    <AppShell title={data?.title ?? "الاختبار المحاكي"} subtitle="أجب ثم صحّح فوراً">
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
          <ListChecks className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">لا توجد أسئلة في هذا الاختبار</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/library" })}>
            رجوع للمكتبة
          </Button>
        </div>
      ) : (
        <>
          {finished ? (
            <div className="mb-4 rounded-3xl bg-hero-gradient p-5 text-center text-primary-foreground shadow-float">
              <p className="text-xs opacity-90">نتيجتك</p>
              <p className="mt-1 text-3xl font-extrabold">
                {score} / {questions.length}
              </p>
              <p className="mt-1 text-xs opacity-90">
                {Math.round((score / questions.length) * 100)}%
              </p>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">
              أجبت عن {Object.keys(answers).length} من {questions.length} سؤالاً
            </p>
          )}

          <div className="space-y-4">
            {questions.map((q, qi) => {
              const chosen = answers[qi];
              return (
                <article
                  key={qi}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <p className="text-sm font-bold leading-relaxed text-foreground">
                    {qi + 1}. {q.question}
                  </p>
                  <div className="mt-3 space-y-2">
                    {q.options.map((option, oi) => {
                      const isChosen = chosen === oi;
                      const isCorrect = oi === q.correct_index;
                      const reveal = finished || chosen !== undefined;
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={finished}
                          onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl border p-3 text-right text-sm transition-colors",
                            reveal && isCorrect
                              ? "border-primary bg-primary-soft font-semibold text-primary"
                              : reveal && isChosen
                                ? "border-destructive/50 bg-destructive/10 text-destructive"
                                : "border-border bg-background hover:bg-muted/50",
                          )}
                        >
                          {reveal && isCorrect ? (
                            <Check className="size-4 shrink-0" />
                          ) : reveal && isChosen ? (
                            <X className="size-4 shrink-0" />
                          ) : (
                            <span className="size-4 shrink-0 rounded-full border border-border" />
                          )}
                          <span className="flex-1">{option}</span>
                        </button>
                      );
                    })}
                  </div>
                  {chosen !== undefined || finished ? (
                    <p className="mt-3 rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                      {q.explanation}
                      {q.page ? ` (صفحة ${q.page})` : ""}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="mt-5 grid gap-2">
            {!finished ? (
              <Button size="lg" onClick={finish}>
                إظهار النتيجة النهائية
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setAnswers({});
                  setFinished(false);
                }}
              >
                <RotateCcw className="size-4" />
                إعادة المحاولة
              </Button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
