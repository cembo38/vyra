"use client";

import { GitCompareArrows } from "lucide-react";
import { useCompareSelection } from "@/components/app/CompareToolbar";
import { cn } from "@/lib/utils";

/**
 * Losstaand van de <Link> van de kaart (zie app/leveranciers/page.tsx) i.p.v.
 * er genest in — een <input> binnen een <a> is ongeldige/verwarrende HTML
 * en een klik op de checkbox zou anders ook meteen naar het profiel
 * navigeren. Zelfde aanpak als eerder bij FavoriteSupplierButton op de
 * shortlist-pagina (Link + losse sibling-knop i.p.v. geneste interactieve
 * elementen).
 */
export function CompareCheckbox({ id, companyName, className }: { id: string; companyName: string; className?: string }) {
  const { selected, toggle, atLimit } = useCompareSelection();
  const checked = selected.has(id);
  const disabled = !checked && atLimit;

  return (
    <label
      title={disabled ? "Je kunt maximaal 4 leveranciers tegelijk vergelijken" : "Selecteer om te vergelijken"}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors",
        checked ? "border-clay bg-clay-50 text-clay-dark" : "border-line bg-white text-ink-faint hover:text-ink",
        disabled && "cursor-not-allowed opacity-40",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => toggle(id, companyName)}
        className="sr-only"
      />
      <GitCompareArrows className="size-3.5" />
      Vergelijk
    </label>
  );
}
