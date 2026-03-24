"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/layout/command-palette";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle, PaletteToggle } from "@/components/layout/theme-controls";

const desktopLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/workouts", label: "Workout Logger" },
  { href: "/exercises", label: "Exercises" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      <header className="sticky top-0 z-30 border-b border-white/30 bg-background/72 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-white/55 bg-card/90 px-4 py-3 shadow-[0_20px_60px_-32px_hsl(var(--foreground)/0.45)] ring-1 ring-black/5 md:px-5">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary/80">Training System</p>
              <p className="text-xl font-semibold tracking-[-0.04em] md:text-2xl">{APP_NAME}</p>
              <p className="truncate text-xs text-muted-foreground md:text-sm">Fast local workout logging for repeatable sessions</p>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggle />
              <PaletteToggle />
              <div className="shrink-0">
                <CommandPalette />
              </div>
              <nav className="hidden gap-2 md:flex md:flex-wrap md:justify-end">
                {desktopLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      pathname === item.href
                        ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_hsl(var(--primary))]"
                        : "border-transparent bg-background/55 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">{children}</main>
      <BottomNav />
    </div>
  );
}
