import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { FEATURES } from "@/lib/features";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية — دراستي AI" },
      {
        name: "description",
        content: "لوحة تحكم دراستي AI: ابدأ التلخيص أو ذاكر مع الأستاذ الرقمي.",
      },
      { property: "og:title", content: "الرئيسية — دراستي AI" },
      { property: "og:description", content: "كل أدوات المذاكرة الذكية في مكان واحد." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    staleTime: 5 * 60_000,
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
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "طالبنا المتفوق";

  return (
    <AppShell
      title={`أهلاً، ${firstName}`}
      subtitle="جاهز لجلسة مذاكرة ذكية؟"
      action={<ThemeToggle />}
    >
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
          search={{ feature: "summarize" }}
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
          {profileLoading ? (
            <Skeleton className="mt-2 h-5 w-24" />
          ) : (
            <p className="mt-2 truncate text-sm font-bold text-foreground">
              {profile?.education_stage ?? "غير محددة"}
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-7 text-base font-bold text-foreground">ترسانة التفوق</h2>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          const card = (
            <>
              <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-2 text-xs font-bold text-foreground">{feature.title}</h3>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {feature.ready ? feature.desc : "قريباً"}
              </p>
            </>
          );
          const className =
            "rounded-2xl border border-border bg-card p-3 text-center shadow-soft transition-transform active:scale-95";

          if (feature.target === "tutor") {
            return (
              <Link key={feature.id} to="/tutor" className={className}>
                {card}
              </Link>
            );
          }
          if (feature.target === "home") {
            return (
              <Link key={feature.id} to="/home" className={className}>
                {card}
              </Link>
            );
          }
          return (
            <Link
              key={feature.id}
              to="/library"
              search={{ feature: feature.id }}
              className={className}
            >
              {card}
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
