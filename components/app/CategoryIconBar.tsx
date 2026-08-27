import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { SUPPLIER_CATEGORY_EMOJI } from "@/components/app/SupplierCategoryIcons";
import { cn } from "@/lib/utils";
import { ScrollFadeX } from "@/components/ui/ScrollFadeX";

/**
 * Doorschuifbare rij categorie-chips boven de zoekresultaten op
 * /leveranciers — geïnspireerd op Airbnb's categorierij. Aanvulling op de
 * categorielijst in het filterpaneel ernaast (met zoekbalk voor wie alle 21
 * opties wil doorzoeken), niet ter vervanging.
 *
 * Cem (aug. 2026): "ik mis de eerder genoemde balk/carrousel dat je
 * meerdere categorieën kunt aanvinken. zorg dat aangevinkte categorieën
 * blijven staan aan het begin en ook aanklikbaar blijven. voeg gepaste
 * emojis toe. zorg ook dat alles op mobiel goed werkt." Drie wijzigingen
 * t.o.v. de vorige (icoon-only, single-select) versie:
 * 1. Multi-select: elke chip TOGGLET zichzelf in de al actieve selectie
 *    i.p.v. de selectie te vervangen — vandaar `hrefFor` (bouwt de juiste
 *    aan/uit-URL) i.p.v. één simpele `buildHref(category)`.
 * 2. Geselecteerde categorieën staan vooraan (zie `orderedItems` in de
 *    parent, app/leveranciers/page.tsx) — categoryItems komt hier al
 *    vooor-gesorteerd binnen, dit component sorteert zelf niets.
 * 3. Emoji (SUPPLIER_CATEGORY_EMOJI) i.p.v. het Lucide-icoontje — leest
 *    sneller op deze kleine, tikbare schaal dan een dunne lijntekening.
 * Bewust nog steeds GEEN "use client": puur server-gerenderde links, elke
 * href is al kant-en-klaar berekend door de server-parent.
 */
export function CategoryIconBar({
  items,
  allActive,
  allHref,
}: {
  items: { key: SupplierCategory; label: string; active: boolean; href: string }[];
  allActive: boolean;
  allHref: string;
}) {
  return (
    <ScrollFadeX className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
      <Link
        href={allHref}
        className={cn(
          "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-colors",
          allActive ? "bg-ink text-paper" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper-dim"
        )}
      >
        <LayoutGrid className="size-4" />
        Alles
      </Link>
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          aria-pressed={it.active}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium transition-colors",
            it.active ? "bg-clay text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper-dim"
          )}
        >
          <span className="text-sm" aria-hidden="true">{SUPPLIER_CATEGORY_EMOJI[it.key]}</span>
          {it.label}
        </Link>
      ))}
    </ScrollFadeX>
  );
}

/** Kant-en-klare items opbouwen uit SUPPLIER_CATEGORY_LABELS — helper voor de server-parent, zodat die niet zelf hoeft te itereren over alle categorieën. */
export function buildCategoryIconBarItems(selected: SupplierCategory[], buildHrefForCategories: (categories: SupplierCategory[]) => string) {
  const selectedSet = new Set(selected);
  const toggleHref = (key: SupplierCategory) =>
    buildHrefForCategories(selectedSet.has(key) ? selected.filter((c) => c !== key) : [...selected, key]);

  const all = (Object.entries(SUPPLIER_CATEGORY_LABELS) as [SupplierCategory, string][]).map(([key, label]) => ({
    key,
    label,
    active: selectedSet.has(key),
    href: toggleHref(key),
  }));

  // Geselecteerde categorieën vooraan (Cem: "blijven staan aan het begin"),
  // daarbinnen + binnen de rest allebei de vaste catalogusvolgorde.
  return [...all.filter((it) => it.active), ...all.filter((it) => !it.active)];
}
