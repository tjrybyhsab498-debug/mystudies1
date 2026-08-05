import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ListChecks,
  Quote,
  Sigma,
  Table2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { SummaryContent } from "@/lib/summary-types";

export const Route = createFileRoute("/_authenticated/summary/$id")({
  head: () => ({
    meta: [
      { title: "الكبسولة الذكية — دراستي AI" },
      {
        name: "description",
        content: "ملخص خارق مع التعريفات والقوانين والتواريخ وأرقام الصفحات.",
      },
      { property: "og:title", content: "الكبسولة الذكية — دراستي AI" },
      { property: "og:description", content: "ملخص شمولي موثّق بأرقام الصفحات من ملزمتك." },
    ],
  }),
  component: SummaryPage,
});

function PageBadge({ page }: { page: number | null }) {
  if (!page) return null;
  return (
    <span className="ms-2 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      ص {page}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof ListChecks;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function SummaryPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["summary", id],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("summaries")
        .select("id, title, status, page_from, page_to, content, error_message, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const content = (data?.content ?? null) as SummaryContent | null;

  return (
    <AppShell
      title={data?.title ?? "الكبسولة الذكية"}
      subtitle={
        data?.page_from && data?.page_to
          ? `صفحات ${data.page_from}–${data.page_to}`
          : "المادة كاملة"
      }
    >
      <Link
        to="/library"
        search={{ feature: "" }}
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-primary"
      >
        <ArrowRight className="size-4" />
        رجوع للمكتبة
      </Link>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : !data ? (
        <p className="py-10 text-center text-sm text-muted-foreground">الملخص غير موجود.</p>
      ) : data.status !== "ready" || !content ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-destructive">
            <AlertTriangle className="size-4" />
            لم يكتمل هذا الملخص
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.error_message ?? "حاول توليد الملخص مرة أخرى من المكتبة."}
          </p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl bg-hero-gradient p-4 text-primary-foreground shadow-float">
            <h2 className="text-sm font-bold">نظرة شاملة</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed opacity-95">
              {content.overview}
            </p>
          </section>

          {content.key_points.length > 0 ? (
            <Section title="أهم النقاط" icon={ListChecks}>
              <ul className="space-y-2">
                {content.key_points.map((point, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>
                      {point.text}
                      <PageBadge page={point.page} />
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {content.terms.length > 0 ? (
            <Section title="التعريفات والمصطلحات" icon={Quote}>
              {content.terms.map((term, i) => (
                <p key={i}>
                  <strong className="text-foreground">{term.term}:</strong> {term.definition}
                  <PageBadge page={term.page} />
                </p>
              ))}
            </Section>
          ) : null}

          {content.formulas.length > 0 ? (
            <Section title="القوانين والمعادلات" icon={Sigma}>
              {content.formulas.map((formula, i) => (
                <div key={i} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-xs font-bold text-foreground">
                    {formula.name}
                    <PageBadge page={formula.page} />
                  </p>
                  <p dir="ltr" className="mt-1 text-left font-mono text-sm">
                    {formula.formula}
                  </p>
                  {formula.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{formula.note}</p>
                  ) : null}
                </div>
              ))}
            </Section>
          ) : null}

          {content.dates.length > 0 ? (
            <Section title="التواريخ والأحداث" icon={CalendarDays}>
              {content.dates.map((item, i) => (
                <p key={i}>
                  <strong className="text-foreground">{item.date}</strong> — {item.event}
                  <PageBadge page={item.page} />
                </p>
              ))}
            </Section>
          ) : null}

          {content.comparisons.length > 0
            ? content.comparisons.map((table, i) => (
                <Section key={i} title={table.title} icon={Table2}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="p-2 text-right">الوجه</th>
                          <th className="p-2 text-right">{table.label_a}</th>
                          <th className="p-2 text-right">{table.label_b}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row, r) => (
                          <tr key={r} className="border-t border-border">
                            <td className="p-2 font-semibold">{row.aspect}</td>
                            <td className="p-2">{row.a}</td>
                            <td className="p-2">{row.b}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              ))
            : null}

          {content.likely_questions.length > 0 ? (
            <Section title="أسئلة متوقعة" icon={AlertTriangle}>
              {content.likely_questions.map((item, i) => (
                <details key={i} className="rounded-xl bg-muted/40 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-foreground">
                    {item.question}
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
