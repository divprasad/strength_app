"use client";

import { useState, useCallback } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/bottom-sheet";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search...",
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  const filtered =
    query.trim() === ""
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase())
        );

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery("");
        }}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-2 text-sm transition-all duration-200",
          "bg-card/70 shadow-e1",
          open
            ? "border-primary/40 ring-4 ring-primary/10"
            : "border-border/70 hover:border-border hover:bg-card/90"
        )}
      >
        <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
          {value ? selectedLabel : placeholder}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {value && (
            <span
              role="button"
              onClick={handleClear}
              className="rounded-full p-0.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground/60 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Bottom Sheet Dropdown */}
      <BottomSheet
        isOpen={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        title={placeholder}
      >
        <div className="flex flex-col h-full max-h-[70vh]">
          {/* Search input */}
          <div className="sticky top-0 z-10 bg-card/98 px-4 pb-3 pt-2 border-b border-border/50">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground/60" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter..."
                className="w-full rounded-xl border border-border/50 bg-background/50 py-2.5 pl-9 pr-8 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 text-muted-foreground/50 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div className="px-2 py-2 overflow-y-auto min-h-0">
            {filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground/60">
                No options found.
              </p>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-left text-sm transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-accent/50 active:bg-accent/70"
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check className="ml-2 h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
