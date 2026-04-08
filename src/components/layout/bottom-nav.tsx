"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Dumbbell, Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const leftItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

const rightItems = [
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/settings", label: "Admin", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  const fabActive = pathname === "/workouts";

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden">
      <div className="mx-auto max-w-lg rounded-2xl border border-border/40 bg-card/90 shadow-e3 backdrop-blur-xl">
        <ul className="grid grid-cols-5 gap-0.5 p-1">
          {/* Left tabs */}
          {leftItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-all duration-300 ease-spring",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute inset-0.5 rounded-xl bg-primary shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.6)] animate-scale-in" />
                  )}
                  <Icon className={cn("relative z-10 h-[18px] w-[18px] transition-transform duration-300", active && "scale-105")} />
                  <span className="relative z-10">{label}</span>
                </Link>
              </li>
            );
          })}

          {/* Center FAB */}
          <li className="flex items-center justify-center">
            <Link
              href="/workouts"
              className={cn(
                "relative -mt-5 flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300 ease-spring",
                fabActive
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.6)] scale-110"
                  : "border-primary/30 bg-primary/90 text-primary-foreground shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.4)] hover:scale-105 hover:shadow-[0_4px_24px_-4px_hsl(var(--primary)/0.6)]"
              )}
            >
              <Dumbbell className="h-6 w-6" />
            </Link>
          </li>

          {/* Right tabs */}
          {rightItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-all duration-300 ease-spring",
                    active
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute inset-0.5 rounded-xl bg-primary shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.6)] animate-scale-in" />
                  )}
                  <Icon className={cn("relative z-10 h-[18px] w-[18px] transition-transform duration-300", active && "scale-105")} />
                  <span className="relative z-10">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
