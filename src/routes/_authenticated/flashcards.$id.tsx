import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Layers, RotateCcw, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/flashcards/$id")({
  head: () => ({
    meta: [
      { title: "الكروت السريعة — دراستي AI" },
      {
        name: "description",
        content: "بطاقات مذاكرة تفاعلية تُقلب باللمس لحفظ سريع ومراجعة ذكية.",
      },
      { property: "og:title", content: "الكروت السريعة — دراستي AI" },
      { property: "og:description", content: "احفظ أسرع ببطاقات مولّدة من ملفاتك." },
    ],
  }),
  component: FlashcardsPage,
});

type Card = { id: string; front: string; back: string; page: number | null };

function FlashcardsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["deck", id],
    queryFn: async () => {
      const [{ data: deck }, { data: cards }] = await Promise.all([
        supabase.from("flashcard_decks").select("id, title, card_count").eq("id", id).maybeSingle(),
        supabase
          .from("flashcards")
          .select("id, front, back, page")
          .eq("deck_id", id)
          .order("position", { ascending: true }),
      ]);
      return { deck, cards: (cards ?? []) as Card[] };
    },
  });

  const cards = data?.cards ?? [];
  const card = cards[index];
  const stats = useMemo(() => {
    const values = Object.values(known);
    return { done: values.length, good: values.filter(Boolean).length };
  }, [known]);

  const mark = async (good: boolean) => {
    if (!card) return;
    setKnown((prev) => ({ ...prev, [card.id]: good }));
    void supabase
      .from("flashcards")
      .update({
        ease: good ? 2 : 0,
        due_at: new Date(Date.now() + (good ? 3 : 1) * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", card.id);
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, cards.length - 1));
  };

  return (
    <AppShell title={data?.deck?.title ?? "بطاقاتي"} subtitle="اقلب البطاقة ثم قيّم نفسك">
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-48 rounded-3xl" />
          <Skeleton className="h-10 rounded-2xl" />
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Layers className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">لا توجد بطاقات في هذه المجموعة</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/library" })}>
            رجوع للمكتبة
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              بطاقة {index + 1} من {cards.length}
            </span>
            <span>
              أعرفها: {stats.good} / {stats.done}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((index + 1) / cards.length) * 100}%` }}
            />
          </div>

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className={cn(
              "mt-4 flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-3xl border p-6 text-center shadow-soft transition-colors",
              flipped ? "border-primary bg-primary-soft" : "border-border bg-card",
            )}
          >
            <span className="text-[11px] font-semibold text-muted-foreground">
              {flipped ? "الإجابة" : "السؤال — اضغط للقلب"}
            </span>
            <span className="text-base font-bold leading-relaxed text-foreground">
              {flipped ? card?.back : card?.front}
            </span>
            {card?.page ? (
              <span className="text-[11px] text-muted-foreground">صفحة {card.page}</span>
            ) : null}
          </button>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2" onClick={() => mark(false)}>
              <X className="size-4 text-destructive" />
              لا أعرفها
            </Button>
            <Button className="gap-2" onClick={() => mark(true)}>
              <Check className="size-4" />
              أعرفها
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              disabled={index === 0}
              onClick={() => {
                setFlipped(false);
                setIndex((i) => Math.max(0, i - 1));
              }}
            >
              <ArrowRight className="size-4" />
              السابقة
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                setKnown({});
                setIndex(0);
                setFlipped(false);
              }}
            >
              <RotateCcw className="size-4" />
              إعادة
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              disabled={index >= cards.length - 1}
              onClick={() => {
                setFlipped(false);
                setIndex((i) => Math.min(cards.length - 1, i + 1));
              }}
            >
              التالية
              <ArrowLeft className="size-4" />
            </Button>
          </div>
        </>
      )}
    </AppShell>
  );
}
