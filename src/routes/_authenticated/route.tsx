import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // الجلسة تُقرأ من الذاكرة/التخزين المحلي (بلا نداء شبكي) كي يكون التنقل فورياً.
    // التحقق الحقيقي يبقى على الخادم في كل دالة محمية عبر requireSupabaseAuth.
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user };
  },
  component: () => <Outlet />,
});
