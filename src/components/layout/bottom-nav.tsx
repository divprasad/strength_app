"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Dumbbell, Home, Settings, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workouts", label: "Logger", icon: Timer },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/history", label: "History", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden">
      <div className="mx-auto max-w-lg rounded-2xl border border-border/40 bg-card/90 shadow-e3 backdrop-blur-xl">
        <ul className="grid grid-cols-6 gap-0.5 p-1">
          {items.map(({ href, label, icon: Icon }) => {
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
                  {/* Active pill background */}
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
