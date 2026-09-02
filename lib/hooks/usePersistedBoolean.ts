"use client";

import { useCallback, useSyncExternalStore } from "react";

// Simpele in-memory pub/sub zodat useSyncExternalStore weet wanneer een
// waarde die WIJ zelf net in localStorage schreven opnieuw gelezen moet
// worden — localStorage's eigen "storage"-event vuurt namelijk alleen in
// ANDERE tabs/vensters, nooit in het tabblad dat de wijziging zelf deed.
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string) {
  return (onStoreChange: () => void) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(onStoreChange);
    return () => listeners.get(key)?.delete(onStoreChange);
  };
}

function readValue(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

/**
 * Onthoudt één true/false-voorkeur van de organisator zelf in de browser
 * (localStorage) — gebruikt door ExpandToggle en AssistantWidget zodat een
 * uitgeklapt/ingeklapt-keuze "onthouden blijft" (Cem, sep. 2026) tussen
 * bezoeken, zonder daarvoor een account, evenement-koppeling of
 * databasewijziging nodig te hebben.
 *
 * `useSyncExternalStore` i.p.v. het gebruikelijkere "useState + lezen in
 * een useEffect"-patroon: dat laatste rendert eerst altijd de SSR-fallback
 * en corrigeert pas zodra de effect draait — een aparte, cascaderende
 * re-render die de linter (react-hooks/set-state-in-effect) terecht
 * afraadt. `useSyncExternalStore` lost exact dit "de server weet het niet,
 * de browser wél"-probleem netjes op: React rendert de eerste keer op de
 * client bewust nog met `fallback` (identiek aan de server, dus geen
 * hydratatie-mismatch) en herstelt daarna in dezelfde correctiestap naar de
 * echte, opgeslagen waarde.
 */
export function usePersistedBoolean(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe(key),
    () => readValue(key, fallback),
    () => fallback
  );
  const setValue = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Kan niet opgeslagen worden (privénavigatie e.d.) — de knop moet wel gewoon werken voor nu.
      }
      notify(key);
    },
    [key]
  );
  return [value, setValue];
}
