import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة — دراستي AI" },
      { name: "description", content: "اختر كلمة مرور جديدة لحسابك في دراستي AI." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة — دراستي AI" },
      { property: "og:description", content: "استعادة الوصول إلى حسابك في دراستي AI." },
    ],
  }),
  component: ResetPassword,
});

const passwordSchema = z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").max(72);

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "كلمة المرور غير صحيحة");
      return;
    }
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: result.data });
    setBusy(false);

    if (error) {
      toast.error("تعذّر تحديث كلمة المرور — قد تكون صلاحية الرابط منتهية");
      return;
    }
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/home", replace: true });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center bg-background px-6">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <KeyRound className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-foreground">كلمة مرور جديدة</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        اختر كلمة مرور قوية لا تقل عن 8 أحرف لحماية حسابك.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور الجديدة</Label>
          <Input
            id="password"
            type="password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={72}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
          <Input
            id="confirm"
            type="password"
            dir="ltr"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={72}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          حفظ كلمة المرور
        </Button>
      </form>
    </div>
  );
}
