import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LogOut, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "حسابي — دراستي AI" },
      { name: "description", content: "مركز القيادة: عدّل ملفك الشخصي والمظهر وإعدادات حسابك." },
      { property: "og:title", content: "حسابي — دراستي AI" },
      { property: "og:description", content: "إدارة ملفك الشخصي والمرحلة الدراسية والمظهر." },
    ],
  }),
  component: ProfilePage,
});

const nameSchema = z.string().trim().min(2, "الاسم قصير جداً").max(80);

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [stage, setStage] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, education_stage, specialty")
        .eq("id", userData.user.id)
        .maybeSingle();
      return { email: userData.user.email ?? "", profile };
    },
  });

  useEffect(() => {
    if (!data?.profile) return;
    setFullName(data.profile.full_name ?? "");
    setStage(data.profile.education_stage ?? "");
    setSpecialty(data.profile.specialty ?? "");
  }, [data]);

  const save = async () => {
    const result = nameSchema.safeParse(fullName);
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "الاسم غير صحيح");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: result.data,
        education_stage: stage.trim() || null,
        specialty: specialty.trim() || null,
      })
      .eq("id", userData.user.id);
    setSaving(false);

    if (error) {
      toast.error("تعذّر حفظ البيانات");
      return;
    }
    toast.success("تم حفظ بياناتك");
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  };

  return (
    <AppShell title="حسابي" subtitle="مركز القيادة والتخصيص">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <UserRound className="size-7" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-foreground">{fullName || "طالب"}</h2>
          <p dir="ltr" className="truncate text-xs text-muted-foreground">
            {data?.email}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="space-y-2">
          <Label htmlFor="name">الاسم الكامل</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stage">المرحلة الدراسية</Label>
          <Input
            id="stage"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            placeholder="مثال: الثالث الثانوي"
            maxLength={80}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialty">التخصص</Label>
          <Input
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="مثال: علمي رياضة"
            maxLength={80}
          />
        </div>
        <Button className="w-full gap-2" onClick={save} disabled={saving}>
          <Save className="size-4" />
          حفظ التعديلات
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div>
          <p className="text-sm font-semibold text-foreground">المظهر التكيفي</p>
          <p className="text-xs text-muted-foreground">التبديل بين الوضع الفاتح والداكن</p>
        </div>
        <ThemeToggle />
      </div>

      <Button variant="outline" className="mt-4 w-full gap-2 text-destructive" onClick={signOut}>
        <LogOut className="size-4" />
        تسجيل الخروج
      </Button>
    </AppShell>
  );
}
