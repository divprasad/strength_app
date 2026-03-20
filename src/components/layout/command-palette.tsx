"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CommandItem = {
  label: string;
  href: string;
  aliases: string[];
};

const COMMANDS: CommandItem[] = [
  { label: "Dashboard", href: "/", aliases: ["home"] },
  { label: "Workout Logger", href: "/workouts", aliases: ["log", "workout", "timer"] },
  { label: "Exercises", href: "/exercises", aliases: [] },
  { label: "History", href: "/history", aliases: [] },
  { label: "Analytics", href: "/analytics", aliases: ["stats", "charts"] },
  { label: "Settings", href: "/settings", aliases: ["prefs"] }
];

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COMMANDS;
    return COMMANDS.filter((command) => {
      const haystack = [command.label, ...command.aliases].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function openPalette() {
    setOpen(true);
  }

  function goTo(href: string) {
    close();
    router.push(href);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 rounded-full border border-primary/15 bg-white/90 px-4 text-foreground shadow-[0_18px_36px_-24px_hsl(var(--foreground)/0.4)] hover:border-primary/30 hover:bg-white"
        onClick={openPalette}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="ml-2 hidden text-[0.72rem] font-semibold uppercase tracking-[0.2em] sm:inline">Quick Find</span>
        <span className="ml-2 text-sm font-medium sm:hidden">Find</span>
        <span className="ml-3 hidden rounded-full border border-primary/10 bg-accent/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80 lg:inline">
          Routes
        </span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close command palette"
            className="absolute inset-0 bg-[hsl(var(--foreground)/0.5)] backdrop-blur-[3px]"
            onClick={close}
          />
          <div className="relative mx-auto flex min-h-full max-w-2xl items-start px-4 pt-20 sm:pt-24">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Jump to command palette"
              className="relative w-full overflow-hidden rounded-[1.85rem] border border-white/45 bg-card/95 text-card-foreground shadow-[0_36px_90px_-44px_hsl(var(--foreground)/0.85)] ring-1 ring-black/5"
            >
              <div className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--accent)/0.35),transparent)] p-4">
                <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-primary/70">Navigate</p>
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Jump to a page"
                  aria-label="Search commands"
                />
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {filtered.length > 0 ? (
                  <ul className="space-y-1">
                    {filtered.map((command) => {
                      const active = pathname === command.href;
                      return (
                        <li key={command.href}>
                          <button
                            type="button"
                            onClick={() => goTo(command.href)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-[1rem] border border-transparent px-3 py-3 text-left text-sm transition-colors hover:border-border/70 hover:bg-accent/55",
                              active && "border-primary/15 bg-accent"
                            )}
                          >
                            <div className="space-y-1">
                              <span className="block font-medium">{command.label}</span>
                              {command.aliases.length > 0 ? (
                                <span className="block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {command.aliases.join(" · ")}
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs text-muted-foreground">{active ? "Current" : command.href}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="px-3 py-10 text-center text-sm text-muted-foreground">No matching commands.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
