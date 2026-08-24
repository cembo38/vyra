import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { SUPPLIER_CATEGORY_ICONS } from "@/components/app/SupplierCategoryIcons";
import { cn } from "@/lib/utils";

/**
 * Doorschuifbare rij icoontjes per categorie boven de zoekfilters op
 * /leveranciers — geïnspireerd op Airbnb's categorierij (tikken filtert
 * meteen, geen dropdown nodig). Aanvulling op de bestaande categorie-
 * <Select> in het filterformulier hieronder, niet ter vervanging: wie liever
 * uit een lijst kiest (bv. met een schermlezer, of gewoon uit gewoonte) kan
 * dat gewoon blijven doen. Puur server-gerenderde links — geen eigen state
 * nodig, `buildHref` behoudt de overige actieve filters (locatie/zoekterm/
 * prijs) bij het wisselen van categorie.
 */
export function CategoryIconBar({
  activeCategory,
  buildHref,
}: {
  activeCategory?: SupplierCategory;
  buildHref: (category?: SupplierCategory) => string;
}) {
  return (
    <div className="scroll-fade-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
      <Link
        href={buildHref(undefined)}
        className={cn(
          "flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors",
          !activeCategory ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-dim"
        )}
      >
        <LayoutGrid className="size-5" />
        Alles
      </Link>
      {(Object.entries(SUPPLIER_CATEGORY_LABELS) as [SupplierCategory, string][]).map(([key, label]) => {
        const Icon = SUPPLIER_CATEGORY_ICONS[key];
        const active = activeCategory === key;
        return (
          <Link
            key={key}
            href={buildHref(key)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors",
              active ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-dim"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
