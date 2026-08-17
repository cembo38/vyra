"use client";

import { ReactNode, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Geen abonnement nodig — dit dient puur om "zijn we op de client, na de
// eerste hydratatie?" te bepalen zonder een `useEffect` + `setState`
// (wat de `react-hooks/set-state-in-effect`-regel van dit project
// terecht afkeurt: dat triggert een cascaderende re-render). Dit is het
// door React zelf aanbevolen `useSyncExternalStore`-patroon voor precies
// dit doel: server geeft altijd `false`, client geeft na hydratatie `true`.
function subscribeNoop() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

/**
 * Generieke uitschuif-overlay — de eerste (en enige) overlay-component in
 * de codebase. Bewust smal gehouden (alleen "van de zijkant uitschuiven",
 * geen volwaardig modal-systeem): destructieve acties (evenement
 * verwijderen/sluiten) gebruiken elders bewust een inline-uitklap-patroon
 * i.p.v. een overlay, en dat blijft zo — dit component is puur voor
 * navigatie (`NavShell`, `MarketingNavDrawer`).
 *
 * Altijd gemount (nooit conditioneel ge-unmount) zodat de CSS-transitie in
 * beide richtingen afspeelt; zichtbaarheid loopt via translate+opacity plus
 * `aria-hidden`/`inert` zodat een gesloten drawer niet met toetsenbord/
 * schermlezer bereikbaar is.
 *
 * Wordt via een portal direct in `document.body` gerenderd i.p.v. op de
 * plek waar `<Drawer>` in de boom staat. Reden: `position: fixed` wordt
 * NIET altijd t.o.v. de viewport gepositioneerd — elke voorouder met
 * `backdrop-filter`, `filter`, `transform` of `contain` (bv. de
 * `backdrop-blur-md` op `MarketingHeader`'s `<header>`) wordt zelf het
 * "containing block", waardoor `inset-y-0` dan t.o.v. díe (vaak veel
 * kleinere) box berekend wordt in plaats van t.o.v. het scherm. Dat gaf
 * hier een drawer-paneel van maar 76px hoog. Een portal naar `body`
 * omzeilt dit soort ancestor-valkuilen structureel, voor nu én voor elke
 * toekomstige plek waar `<Drawer>` gebruikt wordt.
 */
export function Drawer({
  open,
  onClose,
  side = "left",
  widthClassName = "w-[84vw] max-w-[320px]",
  labelledBy,
  testId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  widthClassName?: string;
  labelledBy?: string;
  testId?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // `document.body` bestaat niet tijdens server-rendering; pas na mounten
  // op de client via een portal renderen voorkomt een hydratatiemismatch.
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  if (!mounted) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-ink/40 transition-opacity duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        data-testid={testId}
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col bg-paper pt-[var(--safe-t)] pb-[var(--safe-b)] shadow-[var(--shadow-pop)] transition-transform duration-300 ease-[var(--ease-swift)]",
          side === "left" ? "left-0" : "right-0",
          widthClassName,
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full"
        )}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
