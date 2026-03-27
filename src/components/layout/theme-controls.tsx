"use client";

import { Moon, Sun, Palette } from "lucide-react";
import { useTheme } from "@/components/layout/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full bg-background/55 border border-border/40 hover:bg-accent/20 transition-all active:scale-95"
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Sun className="h-[1.2rem] w-[1.2rem] text-orange-500 transition-all rotate-0 scale-100" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] text-blue-400 transition-all rotate-0 scale-100" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function PaletteToggle() {
  const { palette, cyclePalette } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cyclePalette}
      className="rounded-full bg-background/55 border border-border/40 hover:bg-accent/20 transition-all active:scale-95"
      title="Cycle color palette"
    >
      <div className="relative">
        <Palette className="h-[1.2rem] w-[1.2rem] text-primary" />
        <span className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
          {palette + 1}
        </span>
      </div>
      <span className="sr-only">Cycle palette</span>
    </Button>
  );
}
