import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, GraduationCap, Home, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", label: "الرئيسية", icon: Home },
  { to: "/library", label: "مكتبتي", icon: BookOpen },
  { to: "/tutor", label: "الأستاذ الرقمي", icon: GraduationCap },
  { to: "/profile", label: "حسابي", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur shadow-float">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                preload="render"
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-2xl transition-all",
                    active ? "bg-primary-soft" : "bg-transparent",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
