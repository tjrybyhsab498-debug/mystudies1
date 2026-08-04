import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).catch("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — دراستي AI" },
      {
        name: "description",
        content: "سجّل الدخول أو أنشئ حساباً في دراستي AI لتبدأ مذاكرة أذكى بالذكاء الاصطناعي.",
      },
      { property: "og:title", content: "تسجيل الدخول — دراستي AI" },
      { property: "og:description", content: "بوابة المتفوقين: حساب واحد يزامن كل ملفاتك وملخصاتك." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("البريد الإلكتروني غير صحيح").max(255);
const passwordSchema = z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(72);
const nameSchema = z.string().trim().min(2, "الاسم قصير جداً").max(80);

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, loading: sessionLoading } = useSession();

  const isSignup = mode === "signup";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  useEffect(() => {
    if (!sessionLoading && isAuthenticated) navigate({ to: "/home", replace: true });
  }, [isAuthenticated, sessionLoading, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.issues[0]?.message ?? "البريد غير صحيح");
      return;
    }
    const passResult = passwordSchema.safeParse(password);
    if (!passResult.success) {
      toast.error(passResult.error.issues[0]?.message ?? "كلمة المرور غير صحيحة");
      return;
    }
    if (isSignup) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        toast.error(nameResult.error.issues[0]?.message ?? "الاسم غير صحيح");
        return;
      }
    }

    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: emailResult.data,
          password: passResult.data,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingConfirm(true);
          toast.success("تم إنشاء الحساب! افحص بريدك لتأكيد التسجيل.");
          return;
        }
        toast.success("مرحباً بك في دراستي AI");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailResult.data,
          password: passResult.data,
        });
        if (error) throw error;
        toast.success("تم تسجيل الدخول");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      toast.error(
        message.includes("Invalid login credentials")
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة"
          : message.includes("already registered")
            ? "هذا البريد مسجّل مسبقاً — جرّب تسجيل الدخول"
            : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("تعذّر تسجيل الدخول بحساب Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/home", replace: true });
  };

  const forgotPassword = async () => {
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error("اكتب بريدك الإلكتروني أولاً");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(emailResult.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error("تعذّر إرسال رابط الاستعادة");
      return;
    }
    toast.success("أرسلنا رابط استعادة كلمة المرور إلى بريدك");
  };

  if (pendingConfirm) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 text-center">
        <Sparkles className="mx-auto size-10 text-primary" />
        <h1 className="mt-4 text-xl font-bold text-foreground">افحص بريدك الإلكتروني</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          أرسلنا رابط تأكيد إلى <span className="font-semibold text-foreground">{email}</span>. بعد
          الضغط عليه ستتمكن من الدخول إلى حسابك.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setPendingConfirm(false)}>
          رجوع
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background px-6 pb-10 pt-[calc(env(safe-area-inset-top)+2.5rem)]">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="size-6" />
        <span className="font-extrabold">دراستي AI</span>
      </div>

      <h1 className="mt-8 text-2xl font-extrabold text-foreground">
        {isSignup ? "أنشئ هويتك الرقمية" : "أهلاً بعودتك"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSignup
          ? "حساب واحد يزامن ملازمك وملخصاتك على كل أجهزتك."
          : "سجّل الدخول لتكمل من حيث توقفت."}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {isSignup ? (
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم الكامل</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: أحمد الطالب"
              maxLength={80}
              autoComplete="name"
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@example.com"
            maxLength={255}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <Input
            id="password"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            maxLength={72}
            autoComplete={isSignup ? "new-password" : "current-password"}
          />
        </div>

        {!isSignup ? (
          <button
            type="button"
            onClick={forgotPassword}
            className="text-xs font-medium text-primary hover:underline"
          >
            نسيت كلمة المرور؟
          </button>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSignup ? "إنشاء الحساب" : "تسجيل الدخول"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">أو</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full gap-2"
        onClick={googleSignIn}
        disabled={busy}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.7z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2a7 7 0 0 1-6.6-4.8H1.4v3.1A11.9 11.9 0 0 0 12 24z"
          />
          <path fill="#FBBC05" d="M5.4 14.5a7.1 7.1 0 0 1 0-4.6V6.8H1.4a11.9 11.9 0 0 0 0 10.7l4-3z" />
          <path
            fill="#EA4335"
            d="M12 4.7c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 11.9 11.9 0 0 0 1.4 6.8l4 3.1A7 7 0 0 1 12 4.7z"
          />
        </svg>
        الدخول بحساب Google
      </Button>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {isSignup ? "لديك حساب بالفعل؟ " : "ليس لديك حساب؟ "}
        <Link
          to="/auth"
          search={{ mode: isSignup ? "signin" : "signup" }}
          className="font-semibold text-primary hover:underline"
        >
          {isSignup ? "تسجيل الدخول" : "أنشئ حساباً"}
        </Link>
      </p>
    </div>
  );
}
