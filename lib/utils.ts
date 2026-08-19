import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix: string = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function formatDateNL(iso: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!iso) return null;
  const d = new Date(iso);
  return new Intl.DateTimeFormat("nl-NL", opts ?? { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = target.getTime() - now.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function hoursUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return diff / (1000 * 60 * 60);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

/**
 * KVK-nummers zijn precies 8 cijfers. Dit is bewust alleen een formaat-
 * check, geen echte koppeling met het KVK-handelsregister — dat vereist een
 * (betaalde) KVK API-registratie op naam van Vyra zelf, wat Cem later apart
 * moet aanvragen als hij volledige automatische verificatie wil. Deze check
 * filtert wel meteen overduidelijk foute/verzonnen nummers eruit, als
 * eerste, geautomatiseerde check vóórdat een admin de aanvraag handmatig
 * bekijkt.
 */
export function isValidKvkFormat(kvk: string | null | undefined): boolean {
  return /^\d{8}$/.test((kvk ?? "").trim());
}

/** Directe zoeklink naar het officiële KVK-handelsregister, voor een snelle handmatige cross-check door de admin. */
export function kvkLookupUrl(kvk: string): string {
  return `https://www.kvk.nl/zoeken/?source=species&handelsnaam=&straat=&plaats=&kvknummer=${encodeURIComponent(kvk)}`;
}
