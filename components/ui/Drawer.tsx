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
  panelClassName,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  widthClassName?: string;
  labelledBy?: string;
  testId?: string;
  /** Overschrijft de standaard `bg-paper` paneelachtergrond (bv. `bg-ink` voor een donker paneel zoals de admin-navigatie) — via `cn()`/`twMerge` toegepast, dus de laatste `bg-*`-klasse wint. */
  panelClassName?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    // Andere losstaande uitklap-paneeltjes (bv. het notificatiepaneel van
    // `NotificationsBell`, dat zijn eigen open/dicht-status bijhoudt) horen
    // te sluiten zodra een drawer opent — anders bleef zo'n paneel op
    // mobiel zichtbaar "doorschemeren" achter de drawer. `NotificationsBell`
    // luistert naar dit event.
    window.dispatchEvent(new Event("vyra:overlay-open"));
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
          // z-[55]/z-[60] i.p.v. z-40/z-50: staat bewust boven het
          // notificatiepaneel van `NotificationsBell` (z-50), zodat een
          // drawer altijd een eventueel nog openstaand notificatiepaneel
          // volledig afdekt — ook als dat paneel om wat voor reden dan ook
          // niet (op tijd) door het `vyra:overlay-open`-event is gesloten.
          "fixed inset-0 z-[55] bg-ink/40 transition-opacity duration-300",
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
          "fixed inset-y-0 z-[60] flex flex-col bg-paper pt-[var(--safe-t)] pb-[var(--safe-b)] shadow-[var(--shadow-pop)] transition-transform duration-300 ease-[var(--ease-swift)]",
          side === "left" ? "left-0" : "right-0",
          widthClassName,
          open ? "translate-x-0" : side === "left" ? "-translate-x-full" : "translate-x-full",
          panelClassName
        )}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
