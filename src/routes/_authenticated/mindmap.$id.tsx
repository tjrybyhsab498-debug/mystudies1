import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronLeft, Network } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { SummaryContent } from "@/lib/summary-types";

export const Route = createFileRoute("/_authenticated/mindmap/$id")({
  head: () => ({
    meta: [
      { title: "الرادار البصري — دراستي AI" },
      {
        name: "description",
        content: "خريطة ذهنية شجرية قابلة للطي مبنية على ملخص ملفك الدراسي.",
      },
      { property: "og:title", content: "الرادار البصري — دراستي AI" },
      { property: "og:description", content: "شاهد بنية المادة كاملة في لمحة واحدة." },
    ],
  }),
  component: MindmapPage,
});

function MindmapPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  const { data, isLoading } = useQuery({
    queryKey: ["summary", id],
    queryFn: async () => {
      const { data: row } = await supabase
        .from("summaries")
        .select("id, title, content, status")
        .eq("id", id)
        .maybeSingle();
      return row;
    },
  });

  const content = (data?.content as unknown as SummaryContent | null) ?? null;
  const sections = content?.sections ?? [];

  return (
    <AppShell title="الرادار البصري" subtitle={data?.title ?? "خريطة ذهنية"}>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Network className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">لا توجد بيانات كافية لبناء الخريطة</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ولّد ملخصاً للملف أولاً ثم افتح الخريطة الذهنية.
          </p>
          <Button className="mt-4" onClick={() => navigate({ to: "/library" })}>
            رجوع للمكتبة
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-2xl bg-hero-gradient p-4 text-primary-foreground shadow-float">
            <p className="text-xs opacity-90">الجذر</p>
            <p className="mt-1 text-sm font-bold">{content?.title}</p>
          </div>

          {sections.map((section, i) => {
            const isOpen = open[i] ?? false;
            return (
              <div
                key={i}
                className="relative rounded-2xl border border-border bg-card shadow-soft"
              >
                <button
                  type="button"
                  onClick={() => setOpen((prev) => ({ ...prev, [i]: !isOpen }))}
                  className="flex w-full items-center gap-2 p-3 text-right"
                >
                  {isOpen ? (
                    <ChevronDown className="size-4 shrink-0 text-primary" />
                  ) : (
                    <ChevronLeft className="size-4 shrink-0 text-primary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">
                      {section.heading}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {section.points.length} فكرة
                      {section.page_from ? ` · صفحة ${section.page_from}` : ""}
                    </span>
                  </span>
                </button>
                {isOpen ? (
                  <ul className="space-y-2 border-t border-border/60 p-3 pr-6">
                    {section.intro ? (
                      <li className="text-xs leading-relaxed text-muted-foreground">
                        {section.intro}
                      </li>
                    ) : null}
                    {section.points.map((point, pi) => (
                      <li
                        key={pi}
                        className="relative border-r-2 border-primary/30 pr-3 text-xs leading-relaxed text-foreground"
                      >
                        {point.text}
                        {point.page ? (
                          <span className="mr-1 text-[10px] text-muted-foreground">
                            (ص {point.page})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
