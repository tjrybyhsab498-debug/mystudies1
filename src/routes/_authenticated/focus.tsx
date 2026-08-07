import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({
    meta: [
      { title: "رادار التركيز — دراستي AI" },
      {
        name: "description",
        content: "مؤقت بومودورو لجلسات مذاكرة مركّزة مع إحصاء ساعات إنجازك الأسبوعية.",
      },
      { property: "og:title", content: "رادار التركيز — دراستي AI" },
      { property: "og:description", content: "ذاكر بتركيز عميق وتابع إنجازك." },
    ],
  }),
  component: FocusPage,
});

const PRESETS = [15, 25, 45, 60];

function FocusPage() {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const finishedRef = useRef(false);

  const { data: stats } = useQuery({
    queryKey: ["focus-stats"],
    staleTime: 30_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("focus_sessions")
        .select("minutes, created_at")
        .gte("created_at", since);
      const rows = data ?? [];
      return {
        sessions: rows.length,
        minutes: rows.reduce((acc, r) => acc + (r.minutes ?? 0), 0),
      };
    },
  });

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (remaining !== 0 || finishedRef.current || !running) return;
    finishedRef.current = true;
    setRunning(false);
    void (async () => {
      await supabase.from("focus_sessions").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
        minutes,
        completed: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["focus-stats"] });
      toast.success(`أنجزت جلسة تركيز ${minutes} دقيقة! خذ راحة قصيرة.`);
    })();
  }, [remaining, running, minutes, queryClient]);

  const pick = (value: number) => {
    setMinutes(value);
    setRemaining(value * 60);
    setRunning(false);
    finishedRef.current = false;
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = 1 - remaining / (minutes * 60);

  return (
    <AppShell title="رادار التركيز" subtitle="جلسات بومودورو وإحصاء إنجازك">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <div className="relative mx-auto size-44">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="45" className="fill-none stroke-muted" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r="45"
              className="fill-none stroke-primary transition-all"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 45}
              strokeDashoffset={2 * Math.PI * 45 * (1 - progress)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span dir="ltr" className="text-3xl font-extrabold tabular-nums text-foreground">
              {mm}:{ss}
            </span>
            <span className="text-[11px] text-muted-foreground">دقيقة تركيز</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => pick(value)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                minutes === value
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              {value} د
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            size="lg"
            className="gap-2"
            onClick={() => {
              finishedRef.current = false;
              setRunning((r) => !r);
            }}
          >
            {running ? <Pause className="size-4" /> : <Play className="size-4" />}
            {running ? "إيقاف مؤقت" : "ابدأ"}
          </Button>
          <Button size="lg" variant="outline" className="gap-2" onClick={() => pick(minutes)}>
            <RotateCcw className="size-4" />
            إعادة
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Timer className="size-4" />
            جلسات هذا الأسبوع
          </span>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{stats?.sessions ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="text-xs text-muted-foreground">ساعات التركيز</span>
          <p className="mt-2 text-2xl font-extrabold text-foreground">
            {((stats?.minutes ?? 0) / 60).toFixed(1)}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
