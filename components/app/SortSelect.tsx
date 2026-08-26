"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

/**
 * Compacte sorteer-dropdown voor /leveranciers (spec: "sorteren op prijs/
 * score/reactietijd", vergelijkbaar met Etsy's "Sorteren op"-menu).
 *
 * Krijgt van de server-pagina al kant-en-klare hrefs per sorteeroptie mee
 * (`hrefs`) i.p.v. zelf een href op te bouwen — een functie zoals de
 * server-pagina's eigen `buildHref` kan niet als prop naar een client
 * component (niet serialiseerbaar), dus de pagina rekent de URL's voor elke
 * optie al voor en dit component navigeert er alleen naartoe.
 */
export function SortSelect({
  value,
  options,
  hrefs,
}: {
  value: string;
  options: readonly { key: string; label: string }[];
  hrefs: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <label className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white pl-2.5 pr-1.5 text-sm text-ink-soft">
      <ArrowUpDown className="size-3.5 shrink-0" />
      <span className="sr-only">Sorteren op</span>
      <select
        value={value}
        onChange={(e) => {
          const href = hrefs[e.target.value];
          if (href) router.push(href);
        }}
        className="min-h-8 max-w-[9.5rem] cursor-pointer appearance-none truncate bg-transparent py-1 pr-1 text-sm font-medium text-ink outline-none sm:max-w-none"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
