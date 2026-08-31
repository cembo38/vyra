/**
 * Losstaande, puur-functionele rekenlogica achter de schuiven op de
 * planpagina (components/app/BudgetAllocator.tsx) — hier ondergebracht
 * (i.p.v. inline in het "use client"-component) zodat vitest dit wél kan
 * testen: dit bestand importeert geen "server-only" en geen React, en de
 * verdeel-wiskunde is precies de plek waar een rekenfout het duurst is (een
 * organisator die per ongeluk meer/minder budget toegewezen krijgt dan
 * bedoeld) — zie de "geldberekeningen"-testfilosofie in lib/config.test.ts.
 *
 * HERONTWERP (aug. 2026, gemeld door Cem na een live screenshot): de vorige
 * versie verdeelde het verschil bij het slepen van één schuif *naar
 * verhouding* over alle ANDERE categorieën — met een vast totaalbudget
 * bewoog dus bij elke sleepbeweging letterlijk elke andere schuif ook mee.
 * Cems eigen woorden: "als ik schuif... dan beweegt alles lukraak", met de
 * vraag om iets voorspelbaars met een "vastzet"-optie per categorie. Nieuwe
 * aanpak — "envelope budgeting", zoals bij een fysieke enveloppenbudget-
 * methode: elke categorie heeft een eigen bedrag; er is één gedeelde
 * "nog te verdelen"-pot (het totaalbudget min de som van alle categorieën).
 * Een schuif verhogen haalt UITSLUITEND uit die pot; een schuif verlagen
 * geeft UITSLUITEND aan die pot terug. Andere categorieën veranderen dus
 * nooit meer als bijwerking van iemand anders' sleepbeweging — precies de
 * voorspelbaarheid die Cem vroeg. Het "vastzetten" in de UI is hierdoor geen
 * rekenkundige noodzaak meer (er is toch al niets dat ongevraagd meebeweegt)
 * maar een lichte bescherming tegen jezelf per ongeluk verslepen.
 */

export interface AllocatorItem {
  categoryId: string;
  label: string;
  cents: number;
  /**
   * Optioneel — alleen gebruikt om een `PriorityBadge` te tonen naast het
   * label (zie BudgetAllocator.tsx). Puur weergave, telt niet mee in de
   * rekenlogica hieronder: sinds aug. 2026 verdelen alleen essentiële/
   * aanbevolen categorieën het budget (zie buildDefaultRequirements() in
   * lib/ai/catalog.ts) — een "optional" categorie staat hier vaak op 0
   * totdat de gebruiker 'm zelf aan het plan toevoegt, en dit badge maakt
   * dat op de schuivenlijst zelf al leesbaar als bewuste keuze, geen bug.
   */
  priority?: "essential" | "recommended" | "optional";
}

/**
 * Absolute veiligheidsgrens (in centen) voor wat een categoriebedrag hier
 * ooit mag zijn — onafhankelijk van eventuele foute data die nog in de
 * database staat. Zelfde grens als MAX_PLAUSIBLE_CATEGORY_BUDGET_CENTS in
 * lib/ai/catalog.ts (de server-kant van dezelfde bescherming, bij het
 * genereren/opslaan), hier bewust als eigen losse constante i.p.v. een
 * import — dit bestand blijft afhankelijkheidsvrij zodat vitest het zonder
 * franje kan testen.
 *
 * BUGFIX (gemeld door Cem, aug. 2026, met video): een categorie met nog een
 * oud, absurd groot bedrag (van vóór de AI-vangnetfix) maakte de schuif
 * volledig onbruikbaar. Bij zulke extreme `max`-waarden op een
 * <input type="range"> verliest de browser alle precisie in het omrekenen
 * van vingerpositie naar waarde — elke tik met je vinger leverde een
 * compleet ander, nóg absurder getal op ("shuifjes doen niks", "vinger-
 * suggesties werken niet"). Het extreem lange bedrag ("€ 14.305.806...")
 * duwde bovendien de hele rij (en daarmee de pagina) breder dan het scherm,
 * wat leek alsof de pagina zelf heen en weer schoof. Deze klem zorgt dat
 * zo'n getal nooit het scherm bereikt, ongeacht wat er nog in de database
 * staat.
 */
export const MAX_SANE_CATEGORY_CENTS = 50_000_000; // € 500.000

/** Klemt elke categorie in `items` af op MAX_SANE_CATEGORY_CENTS — zie de toelichting daarboven. */
export function sanitizeItems(items: AllocatorItem[]): AllocatorItem[] {
  return items.map((it) => ({ ...it, cents: Math.min(Math.max(0, it.cents), MAX_SANE_CATEGORY_CENTS) }));
}

/**
 * Hoeveel van het totaalbudget nog niet aan een categorie is toegewezen.
 * `null` zonder vast totaalbudget (er is dan niets om tegen af te zetten).
 * Kan negatief zijn (bv. bestaande data van vóór dit herontwerp, of een
 * organisator die het totaalbudget achteraf verlaagt) — deze functie rondt
 * dat niet stiekem af naar 0, de aanroeper beslist hoe dat getoond wordt.
 */
export function remainingCents(items: AllocatorItem[], totalBudgetCents: number | null): number | null {
  if (totalBudgetCents == null || totalBudgetCents <= 0) return null;
  const allocated = items.reduce((sum, it) => sum + it.cents, 0);
  return totalBudgetCents - allocated;
}

/**
 * Berekent de nieuwe verdeling nadat de schuif op `index` naar `rawValue`
 * is versleept.
 *
 * - Zonder vast totaalbudget (`totalBudgetCents` is null of 0): de schuiven
 *   staan los van elkaar, er is niets om ze aan te binden — alleen de
 *   gesleepte categorie verandert.
 * - Mét een vast totaalbudget ("envelope"-model): een verhoging wordt
 *   geclipt op wat de gedeelde "nog te verdelen"-pot (`remainingCents`)
 *   daadwerkelijk heeft; een verlaging geeft altijd terug aan diezelfde pot.
 *   Geen enkele ANDERE categorie verandert hierbij ooit mee.
 */
export function slideItem(items: AllocatorItem[], index: number, rawValue: number, totalBudgetCents: number | null): AllocatorItem[] {
  // sanitizeItems op de VOLLEDIGE invoer, niet alleen op de gesleepte
  // categorie: bij een al-corrupt bedrag (bv. nog een oud getal van vóór de
  // AI-vangnetfix) levert `current + delta`-rekenwerk verderop anders een
  // compleet ander fout getal op door verlies van precisie bij zulke extreme
  // groottes (double-precision floats hebben maar ~15-17 significante
  // cijfers) — dus eerst alles naar een betrouwbare grootte terugbrengen,
  // dan pas rekenen. Maakt deze functie ook bruikbaar zonder dat de
  // aanroeper zelf al aan sanitizeItems heeft gedacht.
  const sane = sanitizeItems(items);
  const current = sane[index]?.cents ?? 0;
  const clampedRaw = Math.min(Math.max(0, Math.round(rawValue)), MAX_SANE_CATEGORY_CENTS);

  if (totalBudgetCents == null || totalBudgetCents <= 0) {
    return sane.map((it, i) => (i === index ? { ...it, cents: clampedRaw } : it));
  }

  let delta = clampedRaw - current;
  if (delta > 0) {
    const pot = Math.max(0, remainingCents(sane, totalBudgetCents) ?? 0);
    delta = Math.min(delta, pot); // kan nooit meer opeisen dan de pot nog heeft
  }

  return sane.map((it, i) => (i === index ? { ...it, cents: Math.max(0, current + delta) } : it));
}
