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
    <nav className="fixed inset-x-3 bottom-3 z-40 rounded-[1.5rem] border border-white/55 bg-card/92 shadow-[0_24px_50px_-34px_hsl(var(--foreground)/0.45)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-6 gap-1 p-1.5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex min-h-[3.9rem] flex-col items-center justify-center gap-1 rounded-[1rem] border border-transparent text-[11px] transition-colors",
                  active
                    ? "border-primary/15 bg-primary text-primary-foreground shadow-[0_14px_28px_-18px_hsl(var(--primary)/0.85)]"
                    : "text-muted-foreground hover:border-border/70 hover:bg-background/65"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
