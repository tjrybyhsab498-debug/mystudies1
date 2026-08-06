import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // stale-while-revalidate: التنقل بين القوائم يعرض البيانات فوراً من الذاكرة
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // تحميل المسار مسبقاً بمجرد لمس/تمرير المؤشر على الرابط ثم إعادة استخدامه لمدة نصف دقيقة
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
    defaultPreloadDelay: 30,
  });

  return router;
};
