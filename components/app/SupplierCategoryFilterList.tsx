"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SupplierCategoryFilterItem {
  key: string;
  label: string;
  /** Al-gerenderd icoon-element, geen los componenttype — zie de toelichting in NavShell.tsx: dit component is een Client Component en kan geen functie/componenttype als prop krijgen vanuit de server-parent. */
  icon: React.ReactNode;
  count: number;
  href: string;
  active: boolean;
}

/**
 * Categorielijst in de filter-zijbalk/drawer op /leveranciers (voorstel
 * "leveranciers-zijbalk", aug. 2026 — Cem vond het fold-down filterformulier
 * bovenaan niet handig genoeg en vroeg om een professionelere indeling).
 *
 * Vervangt de vroegere platte <Select> met alle 21 categorieën: bij zoveel
 * opties raadt onderzoek naar vergelijkbare marktplaatsen (Airbnb, Etsy) een
 * eigen zoekveld ín het filterpaneel aan, plus een verwacht aantal resultaten
 * per optie. De categorie-iconenbalk boven de resultaten (CategoryIconBar,
 * elders al goed bevonden) blijft daarnaast bestaan voor snelle toegang met
 * één tik — dit hier is voor wie specifiek zoekt of alle opties wil zien.
 *
 * Puur presentationeel/navigatie: elke rij is een <Link> die een kant-en-klare
 * href krijgt (al berekend door de server-parent, want een functie kan niet
 * als prop naar een Client Component). De zoekbalk hierin filtert alleen
 * welke rijen zichtbaar zijn — geen eigen databasequery.
 */
export function SupplierCategoryFilterList({
  items,
  allItem,
}: {
  items: SupplierCategoryFilterItem[];
  allItem: { label: string; count: number; href: string; active: boolean };
}) {
  const [query, setQuery] = useState("");
  const filtered = query.trim()
    ? items.filter((it) => it.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-2">
        <Search className="size-3.5 shrink-0 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek categorie…"
          aria-label="Zoek een leverancierscategorie"
          className="w-full min-w-0 bg-transparent text-xs text-ink-soft outline-none placeholder:text-ink-faint"
        />
      </div>

      <div className="mt-1.5 max-h-56 space-y-0.5 overflow-y-auto pr-0.5">
        {!query.trim() && (
          <Link
            href={allItem.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
              allItem.active ? "bg-clay-50 font-medium text-clay-dark" : "text-ink-soft hover:bg-paper-dim"
            )}
          >
            {allItem.active && <Check className="size-3.5 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{allItem.label}</span>
            <span className="shrink-0 text-xs text-ink-faint">{allItem.count}</span>
          </Link>
        )}
        {filtered.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors",
              it.active ? "bg-clay-50 font-medium text-clay-dark" : "text-ink-soft hover:bg-paper-dim"
            )}
          >
            <span className={cn("shrink-0", it.active ? "text-clay-dark" : "text-ink-faint")}>{it.icon}</span>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="shrink-0 text-xs text-ink-faint">{it.count}</span>
          </Link>
        ))}
        {filtered.length === 0 && <p className="px-2 py-2 text-xs text-ink-faint">Geen categorie gevonden voor &quot;{query}&quot;.</p>}
      </div>
    </div>
  );
}
