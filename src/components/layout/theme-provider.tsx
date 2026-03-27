"use client";

import * as React from "react";
import { db } from "@/lib/db";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  palette: number;
  setTheme: (theme: Theme) => void;
  setPalette: (palette: number) => void;
  toggleTheme: () => void;
  cyclePalette: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("dark");
  const [palette, setPaletteState] = React.useState<number>(0);

  // Initial load from localStorage/system
  React.useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    const savedPalette = localStorage.getItem("palette");
    
    if (savedTheme) {
      setThemeState(savedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setThemeState("light");
    }

    if (savedPalette !== null) {
      setPaletteState(parseInt(savedPalette, 10));
    }
  }, []);

  // Update HTML class and attributes
  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.setAttribute("data-palette", palette.toString());
    
    localStorage.setItem("theme", theme);
    localStorage.setItem("palette", palette.toString());

    // Sync to Dexie if possible
    syncToSettings(theme, palette);
  }, [theme, palette]);

  async function syncToSettings(t: Theme, p: number) {
    try {
      const settings = await db.settings.get("default");
      if (settings) {
        await db.settings.update("default", { themePref: t, paletteIdx: p });
      }
    } catch (e) {
      console.warn("ThemeProvider: Failed to sync to settings", e);
    }
  }

  const setTheme = (t: Theme) => setThemeState(t);
  const setPalette = (p: number) => setPaletteState(p);
  const toggleTheme = () => setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  const cyclePalette = () => setPaletteState((prev) => (prev + 1) % 3);

  return (
    <ThemeContext.Provider value={{ theme, palette, setTheme, setPalette, toggleTheme, cyclePalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
