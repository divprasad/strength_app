"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeToggle, PaletteToggle } from "@/components/layout/theme-controls";
import { CommandPalette } from "@/components/layout/command-palette";

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

const allLinks = [...primaryLinks, ...overflowLinks];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
      "rounded-full border px-4 py-2 text-sm transition-colors whitespace-nowrap",
      pathname === href
        ? "border-primary/20 bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_hsl(var(--primary))]"
        : "border-transparent bg-background/55 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
    );

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      <header className="sticky top-0 z-30 border-b border-white/30 bg-background/72 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-4 rounded-3xl border border-white/55 bg-card/90 px-4 py-3 shadow-e3 ring-1 ring-black/5 md:px-5">
            <div className="min-w-0">
              <p className="text-xl font-semibold tracking-[-0.04em] md:text-2xl">{APP_NAME}</p>
              <p className="text-xs font-medium text-muted-foreground/70 md:text-sm">get jackd</p>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <ThemeToggle />
              <PaletteToggle />
              <CommandPalette />

              {/* ── Desktop nav ── */}
              <nav className="hidden md:flex items-center gap-2">

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
                      "rounded-full border px-3 py-2 text-sm transition-colors",
                      overflowOpen || overflowActive
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "border-transparent bg-background/55 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground"
                    )}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {/* Dropdown */}
                  {overflowOpen && (
                    <div className="absolute right-0 top-full mt-2 min-w-[140px] overflow-hidden rounded-2xl border border-border/70 bg-card/98 shadow-e2 animate-in fade-in zoom-in-95 duration-150">
                      {overflowLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOverflowOpen(false)}
                          className={cn(
                            "flex items-center px-4 py-3 text-sm transition-colors",
                            pathname === item.href
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-foreground hover:bg-accent/60"
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
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">{children}</main>
      <BottomNav />
    </div>
  );
}
