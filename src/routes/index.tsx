import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BrainCircuit, FileText, Sparkles, Mic, Layers, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "دراستي AI — حوّل ملازمك إلى تجربة مذاكرة ذكية" },
      {
        name: "description",
        content:
          "ارفع كتابك أو ملزمتك، واحصل على ملخص خارق وبطاقات واختبارات ومعلم خصوصي بالذكاء الاصطناعي — بالعربية بالكامل.",
      },
      { property: "og:title", content: "دراستي AI — حوّل ملازمك إلى تجربة مذاكرة ذكية" },
      {
        property: "og:description",
        content: "ملخصات، بطاقات، اختبارات، ومعلم ذكي يذاكر معك خطوة بخطوة.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: FileText, title: "الكبسولة الذكية", desc: "ملخص شمولي من ملفك مع تحديد الصفحات" },
  { icon: BrainCircuit, title: "الأستاذ الرقمي", desc: "معلم خصوصي بالطريقة السقراطية" },
  { icon: Layers, title: "الكروت السريعة", desc: "بطاقات تفاعلية للحفظ السريع" },
  { icon: Mic, title: "المذياع الدراسي", desc: "استمع لدروسك كبودكاست أثناء التنقل" },
];

function Landing() {
  const { isAuthenticated, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) navigate({ to: "/home", replace: true });
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <div className="relative overflow-hidden rounded-b-[2.5rem] bg-hero-gradient px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] text-primary-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold">
            <Sparkles className="size-5" />
            دراستي AI
          </span>
          <div className="text-primary-foreground">
            <ThemeToggle />
          </div>
        </div>

        <h1 className="mt-10 text-3xl leading-snug font-extrabold">
          مذاكرة أذكى،
          <br />
          بوقت أقل.
        </h1>
        <p className="mt-3 text-sm leading-relaxed opacity-90">
          حوّل كتبك وملازمك ومحاضراتك إلى ملخصات دقيقة، بطاقات، اختبارات، ومعلم خصوصي يشرح لك خطوة
          بخطوة — بأقوى نماذج الذكاء الاصطناعي.
        </p>

        <div className="mt-7 flex flex-col gap-2">
          <Button asChild size="lg" className="bg-card text-primary hover:bg-card/90">
            <Link to="/auth" search={{ mode: "signup" }}>
              ابدأ مجاناً الآن
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="text-primary-foreground hover:bg-white/15"
          >
            <Link to="/auth" search={{ mode: "signin" }}>
              لدي حساب — تسجيل الدخول
            </Link>
          </Button>
        </div>
      </div>

      <section className="px-5 py-8">
        <h2 className="text-base font-bold text-foreground">ماذا يقدّم لك التطبيق؟</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <article
              key={title}
              className="rounded-2xl border border-border bg-card p-4 shadow-soft"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-border bg-secondary p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-secondary-foreground">
            ملفاتك محفوظة في مستودع سحابي خاص بك، ولا يمكن لأي مستخدم آخر الوصول إليها.
          </p>
        </div>
      </section>
    </div>
  );
}
