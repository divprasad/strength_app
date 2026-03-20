"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/layout/command-palette";
import { BottomNav } from "@/components/layout/bottom-nav";

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
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-xs text-muted-foreground">Fast local workout logging</p>
          </div>
          <div className="flex items-center gap-2">
            <CommandPalette />
            <nav className="hidden gap-1 md:flex">
              {desktopLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm",
                    pathname === item.href ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4 md:py-6">{children}</main>
      <BottomNav />
    </div>
  );
}
