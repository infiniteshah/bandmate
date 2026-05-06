import type { Slot } from "./types";

export type LibraryEntry = {
  code: string;
  role: Slot;
  createdAt: number;
};

const KEY = "bandmate:rooms:v1";

function read(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LibraryEntry =>
        e &&
        typeof e.code === "string" &&
        (e.role === "player1" || e.role === "player2") &&
        typeof e.createdAt === "number",
    );
  } catch {
    return [];
  }
}

function write(entries: LibraryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}
}

export function getEntries(): LibraryEntry[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function recordRoom(code: string, role: Slot): void {
  const upper = code.toUpperCase();
  const entries = read();
  if (entries.some((e) => e.code === upper)) return;
  entries.push({ code: upper, role, createdAt: Date.now() });
  write(entries);
}

export function removeRoom(code: string): void {
  const upper = code.toUpperCase();
  write(read().filter((e) => e.code !== upper));
}
