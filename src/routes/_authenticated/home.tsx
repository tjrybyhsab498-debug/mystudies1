import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  BrainCircuit,
  CalendarClock,
  FileText,
  Layers,
  Mic,
  ScanLine,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية — دراستي AI" },
      { name: "description", content: "لوحة تحكم دراستي AI: ابدأ التلخيص أو ذاكر مع الأستاذ الرقمي." },
      { property: "og:title", content: "الرئيسية — دراستي AI" },
      { property: "og:description", content: "كل أدوات المذاكرة الذكية في مكان واحد." },
    ],
  }),
  component: HomePage,
});

const tools = [
  { icon: FileText, title: "الكبسولة الذكية", desc: "لخّص ملفك", to: "/library" as const },
  { icon: BrainCircuit, title: "الأستاذ الرقمي", desc: "ذاكر بالحوار", to: "/tutor" as const },
  { icon: Layers, title: "الكروت السريعة", desc: "بطاقات للحفظ", to: "/library" as const },
  { icon: Mic, title: "المذياع الدراسي", desc: "استمع لدروسك", to: "/library" as const },
  { icon: ScanLine, title: "عين صقر", desc: "مسح الخط اليدوي", to: "/library" as const },
  { icon: CalendarClock, title: "المخطط السحري", desc: "خطة مذاكرة", to: "/home" as const },
];

function HomePage() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, education_stage")
        .eq("id", userData.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: docCount } = useQuery({
    queryKey: ["documents-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "طالبنا المتفوق";

  return (
    <AppShell title={`أهلاً، ${firstName}`} subtitle="جاهز لجلسة مذاكرة ذكية؟" action={<ThemeToggle />}>
      <section className="rounded-3xl bg-hero-gradient p-5 text-primary-foreground shadow-float">
        <span className="flex items-center gap-2 text-xs font-semibold opacity-90">
          <Sparkles className="size-4" />
          الكبسولة الذكية
        </span>
        <h2 className="mt-3 text-lg font-bold leading-snug">
          ارفع ملزمتك واحصل على ملخص خارق في دقائق
        </h2>
        <Link
          to="/library"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-card px-4 py-2 text-sm font-semibold text-primary"
        >
          ابدأ الآن
        </Link>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <BookOpen className="size-4" />
            ملفاتي
          </span>
          <p className="mt-2 text-2xl font-extrabold text-foreground">{docCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <span className="text-xs text-muted-foreground">المرحلة الدراسية</span>
          <p className="mt-2 truncate text-sm font-bold text-foreground">
            {profile?.education_stage ?? "غير محددة"}
          </p>
        </div>
      </div>

      <h2 className="mt-7 text-base font-bold text-foreground">ترسانة التفوق</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {tools.map(({ icon: Icon, title, desc, to }) => (
          <Link
            key={title}
            to={to}
            className="rounded-2xl border border-border bg-card p-3 text-center shadow-soft transition-transform active:scale-95"
          >
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-5" />
            </span>
            <h3 className="mt-2 text-xs font-bold text-foreground">{title}</h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{desc}</p>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
