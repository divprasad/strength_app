"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Search,
  ArrowRight,
  Plus,
  Zap,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { db } from "@/lib/db";
import { quickCreateExercise, quickStartWorkout } from "@/lib/repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

type ActionResult = {
  ok: boolean;
  message: string;
};

type CommandKind = "navigate" | "action";

type BaseCommand = {
  id: string;
  label: string;
  description?: string;
  aliases: string[];
  kind: CommandKind;
  section: string;
};

type NavigateCommand = BaseCommand & {
  kind: "navigate";
  href: string;
};

type ActionCommand = BaseCommand & {
  kind: "action";
  execute: () => Promise<ActionResult>;
};

type Command = NavigateCommand | ActionCommand;

/* ─── Static navigation commands ─── */

const NAV_COMMANDS: NavigateCommand[] = [
  { id: "nav-dashboard", label: "Dashboard", href: "/", aliases: ["home"], kind: "navigate", section: "Navigate" },
  { id: "nav-workouts", label: "Workout Logger", href: "/workouts", aliases: ["log", "workout", "timer"], kind: "navigate", section: "Navigate" },
  { id: "nav-exercises", label: "Exercises", href: "/exercises", aliases: ["exercise", "library"], kind: "navigate", section: "Navigate" },
  { id: "nav-history", label: "History", href: "/history", aliases: ["past", "previous"], kind: "navigate", section: "Navigate" },
  { id: "nav-analytics", label: "Analytics", href: "/analytics", aliases: ["stats", "charts"], kind: "navigate", section: "Navigate" },
  { id: "nav-settings", label: "Settings", href: "/settings", aliases: ["prefs", "preferences"], kind: "navigate", section: "Navigate" },
];

/* ─── Workout template categories ─── */

const WORKOUT_CATEGORIES = ["Push", "Pull", "Legs"] as const;

/* ─── Component ─── */

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [executing, setExecuting] = useState(false);
  const [feedback, setFeedback] = useState<ActionResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live exercise list for dynamic commands
  const exercises = useLiveQuery(() => db.exercises.orderBy("name").toArray(), []);

  // Build dynamic action commands
  const actionCommands = useMemo<ActionCommand[]>(() => {
    const commands: ActionCommand[] = [];

    // "Add <exercise>" actions — for names that do NOT already exist
    // We only show these when the user types something matching "add ..."
    // to avoid cluttering the palette with hundreds of exercise names.

    // "Start <Category> Workout" actions
    for (const category of WORKOUT_CATEGORIES) {
      commands.push({
        id: `action-start-${category.toLowerCase()}`,
        label: `Start ${category} Workout`,
        description: `Create today's workout and start a ${category.toLowerCase()} session`,
        aliases: [category.toLowerCase(), "start", "begin", "new workout"],
        kind: "action",
        section: "Actions",
        execute: async () => {
          try {
            await quickStartWorkout(`${category} Workout`);
            router.push("/workouts");
            return { ok: true, message: `${category} workout started` };
          } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : "Failed to start workout" };
          }
        },
      });
    }

    return commands;
  }, [router]);

  // Generate "Add <name>" commands dynamically based on the query
  const dynamicExerciseCommands = useMemo<ActionCommand[]>(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized.startsWith("add ") || normalized.length < 5) return [];

    const searchTerm = query.trim().slice(4).trim();
    if (!searchTerm) return [];

    const existingNames = new Set((exercises ?? []).map((e) => e.name.toLowerCase()));

    // Check if it matches an existing exercise exactly
    if (existingNames.has(searchTerm.toLowerCase())) {
      return [{
        id: `action-add-exists-${searchTerm.toLowerCase()}`,
        label: `Add ${searchTerm}`,
        description: "Exercise already exists in your library",
        aliases: [],
        kind: "action",
        section: "Actions",
        execute: async () => {
          return { ok: false, message: `"${searchTerm}" already exists in your library` };
        },
      }];
    }

    // Offer to create the exercise
    return [{
      id: `action-add-${searchTerm.toLowerCase()}`,
      label: `Add ${searchTerm}`,
      description: "Create this exercise in your library",
      aliases: [],
      kind: "action",
      section: "Actions",
      execute: async () => {
        try {
          await quickCreateExercise(searchTerm);
          return { ok: true, message: `"${searchTerm}" added to exercises` };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Failed to create exercise" };
        }
      },
    }];
  }, [query, exercises]);

  // Combine and filter all commands
  const allCommands = useMemo<Command[]>(() => {
    return [...NAV_COMMANDS, ...actionCommands, ...dynamicExerciseCommands];
  }, [actionCommands, dynamicExerciseCommands]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [...NAV_COMMANDS, ...actionCommands];

    return allCommands.filter((command) => {
      const haystack = [command.label, command.description ?? "", ...command.aliases].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, allCommands, actionCommands]);

  // Group filtered commands by section
  const grouped = useMemo(() => {
    const navItems = filtered.filter((c) => c.kind === "navigate");
    const actItems = filtered.filter((c) => c.kind === "action");
    return { navigate: navItems, actions: actItems };
  }, [filtered]);

  const flatList = useMemo(() => [...grouped.navigate, ...grouped.actions], [grouped]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ─── Keyboard shortcut: Cmd+K / Ctrl+K ───
  useEffect(() => {
    function handleGlobalKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setFeedback(null);
      setSelectedIndex(0);
      // Small delay for DOM mount
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Cleanup feedback timer
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFeedback(null);
    setExecuting(false);
  }, []);

  async function executeCommand(command: Command) {
    if (command.kind === "navigate") {
      close();
      router.push(command.href);
      return;
    }

    // Action command
    setExecuting(true);
    setFeedback(null);
    try {
      const result = await command.execute();
      setFeedback(result);
      setExecuting(false);
      // Auto-close on success after a brief delay
      if (result.ok) {
        feedbackTimerRef.current = setTimeout(() => {
          close();
        }, 1200);
      }
    } catch {
      setFeedback({ ok: false, message: "An unexpected error occurred" });
      setExecuting(false);
    }
  }

  function handleKeydown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter" && flatList.length > 0) {
      e.preventDefault();
      const command = flatList[selectedIndex];
      if (command) void executeCommand(command);
      return;
    }
  }

  function renderIcon(command: Command) {
    if (command.kind === "navigate") {
      return <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />;
    }
    if (command.label.startsWith("Start ")) {
      return <Zap className="h-3.5 w-3.5 text-amber-500/70" />;
    }
    return <Plus className="h-3.5 w-3.5 text-emerald-500/70" />;
  }

  function renderSection(title: string, commands: Command[], startIndex: number) {
    if (commands.length === 0) return null;
    return (
      <div key={title}>
        <p className="mb-1.5 mt-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/60 first:mt-0">
          {title === "Navigate" ? (
            <span className="inline-flex items-center gap-1.5">
              <Navigation className="h-2.5 w-2.5" />
              {title}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-2.5 w-2.5" />
              {title}
            </span>
          )}
        </p>
        <ul className="space-y-0.5">
          {commands.map((command, idx) => {
            const globalIndex = startIndex + idx;
            const isSelected = globalIndex === selectedIndex;
            const isCurrentPage = command.kind === "navigate" && pathname === command.href;
            return (
              <li key={command.id}>
                <button
                  type="button"
                  onClick={() => void executeCommand(command)}
                  onMouseEnter={() => setSelectedIndex(globalIndex)}
                  disabled={executing}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[0.85rem] border border-transparent px-3 py-2.5 text-left text-sm transition-all",
                    isSelected
                      ? "border-border/70 bg-accent/60 shadow-[0_2px_8px_-4px_hsl(var(--foreground)/0.15)]"
                      : "hover:bg-accent/30",
                    isCurrentPage && "bg-accent/40",
                    executing && "opacity-50 cursor-wait"
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/80 border border-border/40">
                    {renderIcon(command)}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-[13px] font-medium leading-tight">{command.label}</span>
                    {command.description ? (
                      <span className="block text-[11px] leading-tight text-muted-foreground">
                        {command.description}
                      </span>
                    ) : command.kind === "navigate" && command.aliases.length > 0 ? (
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                        {command.aliases.join(" · ")}
                      </span>
                    ) : null}
                  </div>
                  {command.kind === "navigate" && (
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {isCurrentPage ? "Current" : command.href}
                    </span>
                  )}
                  {command.kind === "action" && (
                    <span className="rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                      Run
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-11 rounded-full border border-primary/15 bg-white/90 px-4 text-foreground shadow-[0_18px_36px_-24px_hsl(var(--foreground)/0.4)] hover:border-primary/30 hover:bg-white"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="ml-2 hidden text-[0.72rem] font-semibold uppercase tracking-[0.2em] sm:inline">Quick Find</span>
        <span className="ml-2 text-sm font-medium sm:hidden">Find</span>
        <span className="ml-3 hidden rounded-full border border-primary/10 bg-accent/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80 lg:inline">
          ⌘K
        </span>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-150">
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
              aria-label="Command palette"
              className="relative w-full overflow-hidden rounded-[1.85rem] border border-white/45 bg-card/95 text-card-foreground shadow-[0_36px_90px_-44px_hsl(var(--foreground)/0.85)] ring-1 ring-black/5 animate-in zoom-in-95 slide-in-from-top-2 duration-200"
              onKeyDown={handleKeydown}
            >
              {/* Search header */}
              <div className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--accent)/0.35),transparent)] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-primary/70">
                    Command Palette
                  </p>
                  <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[9px] font-semibold text-primary/60">
                    Navigate · Add · Start
                  </span>
                </div>
                <Input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setFeedback(null);
                  }}
                  placeholder='Try "Add Bench Press" or "Start Pull Workout"'
                  aria-label="Search commands"
                  disabled={executing}
                />
              </div>

              {/* Feedback banner */}
              {feedback && (
                <div
                  className={cn(
                    "mx-4 mt-3 flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm animate-in zoom-in-95 duration-150",
                    feedback.ok
                      ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400"
                      : "border-destructive/20 bg-destructive/8 text-destructive"
                  )}
                >
                  {feedback.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span className="text-[13px] font-medium">{feedback.message}</span>
                </div>
              )}

              {/* Loading spinner */}
              {executing && (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
                  <span className="text-sm text-muted-foreground">Executing…</span>
                </div>
              )}

              {/* Results */}
              {!executing && (
                <div className="max-h-[60vh] overflow-y-auto p-2">
                  {flatList.length > 0 ? (
                    <div className="space-y-1">
                      {renderSection("Navigate", grouped.navigate as Command[], 0)}
                      {renderSection("Actions", grouped.actions as Command[], grouped.navigate.length)}
                    </div>
                  ) : (
                    <div className="px-3 py-10 text-center">
                      <p className="text-sm text-muted-foreground">No matching commands.</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/60">
                        Try &ldquo;Add &lt;exercise name&gt;&rdquo; to create a new exercise
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer hint */}
              <div className="border-t border-border/50 bg-accent/15 px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60">
                    <kbd className="rounded border border-border/50 bg-background/60 px-1.5 py-0.5 text-[9px] font-mono">↑↓</kbd>
                    {" "}navigate{" "}
                    <kbd className="rounded border border-border/50 bg-background/60 px-1.5 py-0.5 text-[9px] font-mono">↵</kbd>
                    {" "}select{" "}
                    <kbd className="rounded border border-border/50 bg-background/60 px-1.5 py-0.5 text-[9px] font-mono">esc</kbd>
                    {" "}close
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {flatList.length} result{flatList.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
