"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";

import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store";
import { db } from "@/lib/db";

import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle, PaletteToggle } from "@/components/layout/theme-controls";

import { ScaleControl } from "@/components/layout/scale-control";

// At lg+ all 6 are shown inline. At md, only primaryLinks are shown + ⋯ overflow.
const primaryLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/workouts", label: "Logger" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
];

const overflowLinks = [
  { href: "/exercises", label: "Exercises" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sessionActive = useUiStore((s) => s.sessionActive);
  const settings = useLiveQuery(() => db.settings.get("default"), []);
  const appScale = settings?.appScale ?? 1.0;
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    }
    if (overflowOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [overflowOpen]);

  // Active page is in overflow group
  const overflowActive = overflowLinks.some((l) => l.href === pathname);

  const linkClass = (href: string) =>
    cn(
      "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ease-spring whitespace-nowrap",
      pathname === href
        ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.5)]"
        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
    );

  return (
    <div className="min-h-dvh pb-20 md:pb-6">
      <header
        className={cn(
          "sticky top-0 z-30 border-b border-border/20 bg-background/70 backdrop-blur-2xl",
          "transition-all duration-400 ease-spring overflow-hidden",
          sessionActive && pathname === "/workouts"
            ? "max-h-0 opacity-0 pointer-events-none border-transparent"
            : "max-h-32 opacity-100"
        )}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 md:py-3.5">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/30 bg-card/80 px-4 py-2.5 shadow-e2 backdrop-blur-xl md:px-5">
            <div className="min-w-0">
              <p className="text-xl font-bold tracking-[-0.04em] text-foreground md:text-2xl">get jackdd</p>
            </div>

            <div className="flex items-center gap-1.5 md:gap-2.5">
              <ScaleControl />
              <ThemeToggle />
              <PaletteToggle />
              {/* <CommandPalette /> */}

              {/* ── Desktop nav ── */}
              <nav className="hidden md:flex items-center gap-1.5">

                {/* Primary links — always visible at md+ */}
                {primaryLinks.map((item) => (
                  <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                    {item.label}
                  </Link>
                ))}

                {/* Overflow links — visible only at lg+ inline */}
                {overflowLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(linkClass(item.href), "hidden lg:inline-flex")}
                  >
                    {item.label}
                  </Link>
                ))}

                {/* ⋯ overflow button — visible only at md, hidden at lg+ */}
                <div ref={overflowRef} className="relative lg:hidden">
                  <button
                    onClick={() => setOverflowOpen((p) => !p)}
                    aria-label="More navigation"
                    className={cn(
                      "rounded-full border px-3 py-2 text-sm transition-all duration-200",
                      overflowOpen || overflowActive
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {/* Dropdown */}
                  {overflowOpen && (
                    <div className="absolute right-0 top-full mt-2 min-w-[140px] overflow-hidden rounded-xl border border-border/40 bg-card/95 shadow-e2 backdrop-blur-xl animate-scale-in">
                      {overflowLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOverflowOpen(false)}
                          className={cn(
                            "flex items-center px-4 py-2.5 text-sm transition-colors",
                            pathname === item.href
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-muted/50"
                          )}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </nav>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-8" style={{ zoom: appScale }}>{children}</main>
      <BottomNav />
    </div>
  );
}
