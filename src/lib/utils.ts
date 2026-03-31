import { clsx, type ClassValue } from "clsx";
import { format, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return `${prefix}_${cryptoApi.randomUUID()}`;
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}_${hex}`;
  }

  const fallback = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${fallback}`;
}

export function createStableId(prefix: string, seed: string): string {
  // Simple deterministic "hash" for stable IDs (e.g. for exercises in seed)
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, "0");
  return `${prefix}_static_${hex}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Filesystem-safe UTC timestamp for filenames: `2026-03-30T20-08-21Z` */
export function fileTimestamp(date: Date = new Date()): string {
  return date.toISOString().split(".")[0].replace(/:/g, "-") + "Z";
}

export function localDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatLocalDate(dateIso: string, fmt = "EEE, MMM d"): string {
  return format(parseISO(dateIso), fmt);
}

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
