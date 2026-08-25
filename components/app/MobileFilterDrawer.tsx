"use client";

import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";

/**
 * Filterknop + uitschuifmenu op /leveranciers onder de `lg`-zijbalk-
 * breakpoint (telefoon en iPad-portret) — voorstel "leveranciers-zijbalk",
 * aug. 2026. Hergebruikt gewoon de bestaande `Drawer` (mobiele-navigatie-
 * update) i.p.v. een eigen overlay te bouwen: dat geeft dit paneel de
 * `vyra:overlay-open`-samenwerking met het notificatiepaneel/hamburgermenu
 * automatisch cadeau, zie Drawer.tsx.
 *
 * `activeCount` bepaalt het telbadge op de knop; `children` is de
 * al-gerenderde inhoud van `SupplierFilterPanel` (server-rendered, als
 * kant-en-klaar element doorgegeven — dit component is zelf Client, dus kan
 * geen server-only logica bevatten, wél al-gerenderde children ontvangen).
 *
 * Geen eigen sluit-logica nodig bij het kiezen van een categorielink of het
 * versturen van het zoekformulier: de pagina rendert dit component met
 * `key={searchParamsString}` (zie app/leveranciers/page.tsx), dus bij élke
 * wijziging van de actieve filters wordt dit component simpelweg opnieuw
 * gemount en valt `open` terug naar `false` — hetzelfde `key`-herstart-
 * patroon als BudgetAllocator.tsx elders in de app.
 *
 * `formId` moet overeenkomen met het `formId`/`id` van het `<form>` in de
 * meegegeven `children` (SupplierFilterPanel) — de knop onderaan gebruikt
 * het HTML5 `form`-attribuut om dat formulier te versturen ondanks dat de
 * knop er zelf geen afstammeling van is (staat in de sticky footer, buiten
 * de scrollbare formulier-inhoud). Zo verstuurt "Toon N resultaten" ook een
 * getypt maar nog niet met "Zoeken" bevestigd tekstveld (locatie/prijs).
 */
export function MobileFilterDrawer({
  children,
  activeCount,
  resultCount,
  formId,
  hasFilters,
  clearHref,
}: {
  children: React.ReactNode;
  activeCount: number;
  resultCount: number;
  formId: string;
  hasFilters: boolean;
  clearHref: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-soft"
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-clay text-[10px] font-bold text-white">
            {activeCount}
          </span>
        )}
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} side="right" widthClassName="w-[88vw] max-w-[360px]" labelledBy="supplier-filter-drawer-title">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <span id="supplier-filter-drawer-title" className="font-display text-lg text-ink">
            Filters
          </span>
          <div className="flex items-center gap-3">
            {hasFilters && (
              <Link href={clearHref} onClick={() => setOpen(false)} className="text-xs font-medium text-ink-faint hover:text-ink">
                Wis alles
              </Link>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Filters sluiten" className="icon-pop flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim">
              <X className="size-4.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="border-t border-line-soft px-5 py-4 pb-[max(var(--safe-b),1rem)]">
          <button
            type="submit"
            form={formId}
            className="lift-hover w-full rounded-xl bg-clay px-5 py-3 text-center text-sm font-medium text-white hover:bg-clay-dark"
          >
            Toon {resultCount} resultaten
          </button>
        </div>
      </Drawer>
    </>
  );
}
