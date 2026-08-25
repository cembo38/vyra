import Link from "next/link";
import { BookmarkPlus, Search as SearchIcon } from "lucide-react";
import { Field, Input } from "@/components/ui/Form";
import { saveSearchAction } from "@/lib/actions/misc-actions";
import { SupplierCategory } from "@/lib/types";
import { SupplierCategoryFilterItem, SupplierCategoryFilterList } from "@/components/app/SupplierCategoryFilterList";

/**
 * Het filterpaneel op /leveranciers — sinds het "zijbalk"-voorstel (aug.
 * 2026) hergebruikt op twee plekken: als vaste zijbalk vanaf `lg` (zie
 * app/leveranciers/page.tsx) en als inhoud van de mobiele MobileFilterDrawer
 * daaronder. Bewust GEEN "use client": dit is verder gewoon hetzelfde
 * server-gerenderde `<form method="get">`-patroon als de rest van de app
 * (geen React-state nodig behalve de categoriezoekbalk, die als eigen
 * kleine Client Component — SupplierCategoryFilterList — is uitgesneden).
 *
 * `category` en `view` gaan als verborgen velden mee in het formulier zodat
 * het versturen van bijv. een nieuwe locatie de al actieve categorie/
 * weergave niet stilzwijgend wist.
 */
export function SupplierFilterPanel({
  formId,
  q,
  location,
  minPriceEuros,
  maxPriceEuros,
  categories,
  view,
  hasFilters,
  clearHref,
  categoryItems,
  allItem,
  showSaveSearch,
  showHeading = true,
}: {
  formId: string;
  q: string;
  location: string;
  minPriceEuros: number | undefined;
  maxPriceEuros: number | undefined;
  /** Meerdere categorieën tegelijk aan te vinken (Cem, aug. 2026) — komma-gescheiden in het verborgen formulierveld, zie parseCategories() in app/leveranciers/page.tsx. */
  categories: SupplierCategory[];
  view: "lijst" | "kaart";
  hasFilters: boolean;
  clearHref: string;
  categoryItems: SupplierCategoryFilterItem[];
  allItem: { label: string; count: number; href: string; active: boolean };
  showSaveSearch: boolean;
  /** In de mobiele drawer (MobileFilterDrawer) toont het paneel zelf al een "Filters"-titel + "Wis alles" in zijn eigen header — deze interne kop zou daar dus dubbelop staan. Alleen de desktop-zijbalk (die geen andere kop heeft) zet dit op true. */
  showHeading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {showHeading && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Filters</span>
          {hasFilters && (
            <Link href={clearHref} className="text-xs font-medium text-ink-faint hover:text-ink">
              Wis alles
            </Link>
          )}
        </div>
      )}

      <form id={formId} method="get" action="/leveranciers" className="flex flex-col gap-5">
        <input type="hidden" name="categories" value={categories.join(",")} />
        <input type="hidden" name="view" value={view === "kaart" ? "kaart" : ""} />

        <Field label="Wat zoek je?" hint="Bijv. 'live band voor bruiloft'">
          <Input name="q" defaultValue={q} placeholder="Zoekterm..." />
        </Field>

        <div className="border-t border-line-soft pt-4">
          <span className="mb-2 block text-xs font-semibold tracking-wide text-ink-faint uppercase">Categorie</span>
          <SupplierCategoryFilterList items={categoryItems} allItem={allItem} />
        </div>

        <div className="border-t border-line-soft pt-4">
          <Field label="Plaats / regio" hint="Werkgebied van de leverancier">
            <Input name="location" defaultValue={location} placeholder="Bijv. Utrecht" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line-soft pt-4">
          <Field label="Prijs vanaf (€)">
            <Input name="minPrice" type="number" min={0} step={1} defaultValue={minPriceEuros ?? ""} />
          </Field>
          <Field label="Prijs tot (€)">
            <Input name="maxPrice" type="number" min={0} step={1} defaultValue={maxPriceEuros ?? ""} />
          </Field>
        </div>

        <button
          type="submit"
          className="lift-hover hidden items-center justify-center gap-1.5 rounded-xl bg-clay px-5 py-2.5 text-sm font-medium text-white hover:bg-clay-dark lg:flex"
        >
          <SearchIcon className="size-4" /> Zoeken
        </button>
      </form>

      {showSaveSearch && (
        // Los van het formulier hierboven — HTML staat geen geneste <form>s
        // toe. Krijgt dezelfde filters als verborgen velden mee zodat
        // "Bewaren" altijd de zoekopdracht bewaart die nu op het scherm staat.
        <form action={saveSearchAction} className="border-t border-line-soft pt-4">
          {/* saveSearchAction/SavedSearch werken nog met precies één categorie
              (spec) — showSaveSearch staat daarom alleen aan bij 0 of 1
              geselecteerde categorie, dus categories[0] is hier ondubbelzinnig. */}
          <input type="hidden" name="category" value={categories[0] ?? ""} />
          <input type="hidden" name="location" value={location} />
          <input type="hidden" name="q" value={q} />
          <button type="submit" className="chip-hover flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-xs font-semibold text-sage-dark">
            <BookmarkPlus className="size-3.5" /> Bewaar deze zoekopdracht
          </button>
        </form>
      )}
    </div>
  );
}
