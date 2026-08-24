/**
 * Losstaande, puur-functionele rekenlogica achter de schuiven op de
 * planpagina (components/app/BudgetAllocator.tsx) — hier ondergebracht
 * (i.p.v. inline in het "use client"-component) zodat vitest dit wél kan
 * testen: dit bestand importeert geen "server-only" en geen React, en de
 * verdeel-wiskunde is precies de plek waar een rekenfout het duurst is (een
 * organisator die per ongeluk meer/minder budget toegewezen krijgt dan
 * bedoeld) — zie de "geldberekeningen"-testfilosofie in lib/config.test.ts.
 */

export interface AllocatorItem {
  categoryId: string;
  label: string;
  cents: number;
}

/**
 * Berekent de nieuwe verdeling nadat de schuif op `index` naar `rawValue`
 * is versleept.
 *
 * - Zonder vast totaalbudget (`hasFixedTotal` = false): de schuiven staan
 *   los van elkaar, er is niets om ze aan te binden — alleen de gesleepte
 *   categorie verandert.
 * - Mét een vast totaalbudget: de schuiven zijn gekoppeld. Het verschil dat
 *   deze categorie erbij krijgt (of inlevert) wordt naar verhouding bij de
 *   ANDERE categorieën weggehaald (of teruggegeven), zodat de som altijd
 *   exact het totaalbudget blijft — nooit meer, nooit minder. Kan de rest
 *   samen niet genoeg missen (othersSum < gevraagde toename), dan wordt de
 *   schuif zelf geclipt op wat er daadwerkelijk beschikbaar is. Hebben alle
 *   andere categorieën al €0 (othersSum === 0) en komt er budget vrij (een
 *   verlaging van deze schuif), dan wordt dat gelijk over de rest verdeeld
 *   — er is dan geen bestaande verhouding om op te schalen.
 */
export function redistributeSlide(items: AllocatorItem[], index: number, rawValue: number, hasFixedTotal: boolean): AllocatorItem[] {
  if (!hasFixedTotal) {
    return items.map((it, i) => (i === index ? { ...it, cents: Math.max(0, rawValue) } : it));
  }

  const current = items[index].cents;
  const others = items.filter((_, i) => i !== index);
  const othersSum = others.reduce((sum, it) => sum + it.cents, 0);
  let delta = rawValue - current;
  if (delta > 0) delta = Math.min(delta, othersSum); // kan nooit meer opeisen dan de rest nog heeft

  return items.map((it, i) => {
    if (i === index) return { ...it, cents: current + delta };
    if (othersSum === 0) return { ...it, cents: Math.max(0, it.cents - delta / others.length) };
    const share = it.cents / othersSum;
    return { ...it, cents: Math.max(0, Math.round(it.cents - delta * share)) };
  });
}
