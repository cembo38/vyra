"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistedBoolean } from "@/lib/hooks/usePersistedBoolean";

/**
 * Herbruikbare "toon meer/toon minder"-knop die zijn open/dicht-status
 * onthoudt (Cem, sep. 2026, over het rustiger-dashboardvoorstel: "ik wil
 * ook dat je de optie geeft om tekst vakken uit te vouwen, en dat die ook
 * onthouden blijven") — eenmaal uitgeklapt blijft een sectie dus uitgeklapt
 * bij een volgend bezoek, in plaats van elke keer weer standaard ingeklapt
 * te starten. Gebruikt op het dashboard voor de lange Categorieën/Taken-
 * lijsten en de extra aandachtspunten in de statusbanner.
 *
 * Dit is een schermvoorkeur van de organisator zelf, niet gekoppeld aan
 * een account of specifiek evenement — bewust in de browser opgeslagen
 * (localStorage) i.p.v. in de database: geen server-actie, geen migratie,
 * geen inlognodig, en werkt meteen ook voor bezoekers die (nog) niet
 * ingelogd zijn. Nadeel: de voorkeur is per browser/apparaat, niet
 * gesynchroniseerd — voor een simpele "toon dit voortaan altijd"-knop is
 * dat een prima afweging.
 *
 * Start bewust altijd dicht tijdens de eerste, server-gerenderde weergave
 * (voorkomt een hydratatie-mismatch tussen server en browser) en
 * synchroniseert daarna meteen met wat er in localStorage staat — bij een
 * eerder uitgeklapte sectie is dat een onmerkbare flits.
 */
export function ExpandToggle({
  storageKey,
  moreLabel,
  lessLabel,
  children,
}: {
  /** Uniek per plek in de app, bv. "dashboard-categorieen" — wordt de localStorage-sleutel. */
  storageKey: string;
  moreLabel: string;
  lessLabel: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = usePersistedBoolean(`vyra:uitgeklapt:${storageKey}`, false);

  function toggle() {
    setExpanded(!expanded);
  }

  return (
    <>
      {expanded && children}
      <button type="button" onClick={toggle} className="mt-2.5 flex items-center gap-1 text-sm font-medium text-clay hover:underline">
        {expanded ? lessLabel : moreLabel}
        <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
      </button>
    </>
  );
}
