"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompareArrows, X } from "lucide-react";

/**
 * "Leveranciers direct vergelijken vanuit zoekresultaten" (livegang-audit,
 * vergelijkbaar met een compare-tool bij Bol.com/Coolblue) — een
 * organisator kon tot nu toe alleen leveranciers ná een aanvraag naast
 * elkaar zien (de bestaande CompareTable/CompareCardList in
 * OfferBrowser.tsx, dat vergelijkt INGEDIENDE OFFERTES binnen één
 * aanvraag). Dit hier vergelijkt leveranciers rechtstreeks vanuit de
 * zoekresultaten, nog vóórdat er sprake is van een aanvraag.
 *
 * Context i.p.v. props doorgeven: /leveranciers/page.tsx rendert de
 * kaartenlijst zelf (server-side, met alle bestaande filter/sorteerlogica
 * ongewijzigd) en geeft die JSX als `children` mee aan deze client-
 * component. Elke kaart bevat een <CompareCheckbox> (ook een
 * client-component) die via useContext meepraat, zonder dat de
 * server-pagina zelf iets van selectiestatus hoeft te weten.
 *
 * Bewust GEEN persistente opslag (localStorage) — een compare-selectie is
 * per definitie iets van "nu, tijdens het rondkijken", geen instelling die
 * je wilt terugvinden na een nieuwe sessie.
 */
const MAX_COMPARE = 4;

const CompareContext = createContext<{
  selected: Map<string, string>;
  toggle: (id: string, companyName: string) => void;
  atLimit: boolean;
} | null>(null);

export function useCompareSelection() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompareSelection moet binnen <CompareToolbar> gebruikt worden");
  return ctx;
}

export function CompareToolbar({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const router = useRouter();

  const toggle = useCallback((id: string, companyName: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_COMPARE) return prev;
        next.set(id, companyName);
      }
      return next;
    });
  }, []);

  const atLimit = selected.size >= MAX_COMPARE;

  return (
    <CompareContext.Provider value={{ selected, toggle, atLimit }}>
      {children}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 pb-[max(var(--safe-b),0.75rem)] pt-3 [box-shadow:0_-4px_16px_rgba(0,0,0,0.06)] md:pl-[var(--nav-sidebar-w)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm text-ink-soft">
              <GitCompareArrows className="size-4 shrink-0 text-clay" />
              <span className="truncate">
                {selected.size === 1 ? "1 leverancier geselecteerd" : `${selected.size} leveranciers geselecteerd`}
                {atLimit && " (maximaal 4)"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Map())}
                aria-label="Selectie wissen"
                className="flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim"
              >
                <X className="size-4" />
              </button>
              <button
                type="button"
                disabled={selected.size < 2}
                onClick={() => router.push(`/leveranciers/vergelijk?ids=${Array.from(selected.keys()).join(",")}`)}
                className="lift-hover rounded-full bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-dark disabled:opacity-40 disabled:pointer-events-none"
              >
                Vergelijk
              </button>
            </div>
          </div>
        </div>
      )}
    </CompareContext.Provider>
  );
}
