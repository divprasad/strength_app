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
        variant="secondary"
        size="sm"
        className="gap-2"
        onClick={openPalette}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Jump to…</span>
        <span className="sm:hidden">Jump</span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close command palette"
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={close}
          />
          <div className="relative mx-auto flex min-h-full max-w-2xl items-start px-4 pt-20 sm:pt-24">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Jump to command palette"
              className="relative w-full overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl"
            >
              <div className="border-b p-4">
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
                              "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition-colors hover:bg-accent",
                              active && "bg-accent"
                            )}
                          >
                            <span className="font-medium">{command.label}</span>
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
