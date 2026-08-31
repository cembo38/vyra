import { EventCore, EventType, RequirementCategory, RequirementPriority, SupplierCategory, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { SUPPLIERS } from "@/lib/data/suppliers";
import { uid } from "@/lib/utils";

export const ALL_SUPPLIER_CATEGORIES = Object.keys(SUPPLIER_CATEGORY_LABELS) as SupplierCategory[];

/**
 * Typische Nederlandse marktprijs per categorie, in centen — het gemiddelde
 * van de demo-leveranciers' `avgPriceCents` per categorie (representatieve
 * richtprijzen, niet gekoppeld aan hoeveel échte leveranciers er op dit
 * moment al zijn aangemeld). Dit is bewust losgekoppeld van de live
 * `supplier_accounts`-tabel: in een jonge marktplaats met nog maar een
 * handvol echte aanmeldingen zou een gemiddelde daarvan voor de meeste
 * categorieën gewoon leeg/onbetrouwbaar zijn. Gebruikt als vangnet zodat
 * elke categorie altijd een realistische budgetschatting krijgt, ook
 * wanneer de organisator (nog) geen totaalbudget heeft opgegeven — eerder
 * gaf het ontbreken van een totaalbudget stilzwijgend "geen schatting"
 * (`null`) voor élke categorie, wat het budgetoverzicht altijd op €0 liet
 * staan totdat iemand zelf een totaalbudget had ingevuld.
 */
export const TYPICAL_CATEGORY_COST_CENTS: Partial<Record<SupplierCategory, number>> = (() => {
  const sums: Partial<Record<SupplierCategory, { total: number; count: number }>> = {};
  for (const supplier of SUPPLIERS) {
    const entry = sums[supplier.category] ?? { total: 0, count: 0 };
    entry.total += supplier.avgPriceCents;
    entry.count += 1;
    sums[supplier.category] = entry;
  }
  const result: Partial<Record<SupplierCategory, number>> = {};
  for (const [category, { total, count }] of Object.entries(sums) as [SupplierCategory, { total: number; count: number }][]) {
    result[category] = Math.round(total / count);
  }
  return result;
})();

/**
 * Harde bovengrens voor wat een AI-geschat categoriebudget mag zijn, in
 * centen — een vangnet tegen een taalmodel dat een absurd getal
 * hallucineert (gemeld door Cem, aug. 2026: "Tentverhuur" kreeg een schatting
 * van tientallen miljarden euro's voor een gewoon dansfeest, terwijl de
 * organisator nog geen totaalbudget had opgegeven — `capEstimatesToBudget`
 * hieronder grijpt dan niet in, want die heeft niets om tegen te toetsen).
 * Ruim boven wat één categorie voor een privé-evenement in Nederland ooit
 * realistisch zou moeten kosten, maar laag genoeg om zo'n hallucinatie er
 * gegarandeerd uit te filteren.
 */
export const MAX_PLAUSIBLE_CATEGORY_BUDGET_CENTS = 50_000_000; // € 500.000

/**
 * Filtert één door de AI geschat categoriebudget door de plausibiliteits-
 * check hierboven. Niet-eindig (NaN/Infinity), negatief of absurd hoog valt
 * terug op de typische marktprijs voor die categorie (of `null` als die niet
 * bekend is) — dezelfde vangnetgedachte als de bestaande `mockFallback` bij
 * een AI-fout, nu ook voor een AI-antwoord dat wél binnenkomt maar
 * onbruikbaar is.
 */
export function sanitizeEstimatedBudgetCents(value: number | null, categoryKey: SupplierCategory): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > MAX_PLAUSIBLE_CATEGORY_BUDGET_CENTS) {
    return TYPICAL_CATEGORY_COST_CENTS[categoryKey] ?? null;
  }
  return Math.round(value);
}

interface Template {
  categoryKey: SupplierCategory;
  priority: RequirementPriority;
  rationale: string;
  weight: number; // relatief gewicht voor budgetverdeling
}

const priorityWeight: Record<RequirementPriority, number> = { essential: 3, recommended: 2, optional: 1 };

/**
 * Basiscatalogus per eventtype. Dit is de deterministische mock-basis voor
 * de Requirement Generator AI (gebruikt wanneer er geen AI-key is
 * geconfigureerd, of als fallback bij een AI-fout). Met een echte AI-key
 * wordt dit dynamisch en context-specifieker gegenereerd door het model.
 */
const TEMPLATES: Record<EventType, Template[]> = {
  wedding: [
    { categoryKey: "venue", priority: "essential", weight: 5, rationale: "De locatie bepaalt de basis voor alle andere keuzes bij een bruiloft." },
    { categoryKey: "catering", priority: "essential", weight: 5, rationale: "Een bruiloft vraagt vrijwel altijd om volledige catering voor alle gasten." },
    { categoryKey: "photography", priority: "essential", weight: 3, rationale: "Fotografie legt de belangrijkste dag van jullie leven vast." },
    { categoryKey: "dj_music", priority: "essential", weight: 2, rationale: "Muziek en een feestavond horen bij vrijwel elke bruiloft." },
    { categoryKey: "furniture_rental", priority: "essential", weight: 2, rationale: "Aanvullend meubilair is nodig zodra je buiten een standaardzaal huurt." },
    { categoryKey: "planner", priority: "recommended", weight: 3, rationale: "Een coördinator op de dag zelf voorkomt stress voor jou en je gasten." },
    { categoryKey: "florist", priority: "recommended", weight: 2, rationale: "Bloemwerk versterkt de sfeer en stijl van je bruiloft." },
    { categoryKey: "cake", priority: "recommended", weight: 1, rationale: "Een bruidstaart is een klassiek onderdeel van het dessert." },
    { categoryKey: "decoration", priority: "recommended", weight: 2, rationale: "Styling maakt je gekozen thema zichtbaar door de hele locatie." },
    { categoryKey: "videography", priority: "optional", weight: 2, rationale: "Een huwelijksfilm is een mooie aanvulling naast foto's." },
    { categoryKey: "lighting_sound", priority: "recommended", weight: 2, rationale: "Sfeerverlichting maakt het verschil tussen diner en feestavond." },
    { categoryKey: "cleaning", priority: "optional", weight: 1, rationale: "Bij een externe locatie is eindschoonmaak vaak vereist." },
  ],
  birthday: [
    { categoryKey: "catering", priority: "essential", weight: 4, rationale: "Eten en drinken zijn de kern van een verjaardagsfeest." },
    { categoryKey: "furniture_rental", priority: "essential", weight: 2, rationale: "Voldoende zitplaatsen zijn nodig voor al je gasten." },
    { categoryKey: "dj_music", priority: "recommended", weight: 2, rationale: "Muziek zet de toon voor een geslaagd feest." },
    { categoryKey: "cake", priority: "recommended", weight: 1, rationale: "Een verjaardagstaart hoort bij het moment van vieren." },
    { categoryKey: "decoration", priority: "optional", weight: 1, rationale: "Decoratie maakt de feestlocatie herkenbaar en feestelijk." },
    { categoryKey: "photobooth", priority: "optional", weight: 1, rationale: "Een photobooth is een leuke, laagdrempelige attractie voor gasten." },
  ],
  anniversary: [
    { categoryKey: "venue", priority: "recommended", weight: 3, rationale: "Een passende locatie maakt een jubileum extra bijzonder." },
    { categoryKey: "catering", priority: "essential", weight: 4, rationale: "Een gezamenlijke maaltijd staat vaak centraal bij een jubileumviering." },
    { categoryKey: "decoration", priority: "recommended", weight: 1, rationale: "Decoratie benadrukt het feestelijke karakter van het jubileum." },
    { categoryKey: "dj_music", priority: "recommended", weight: 2, rationale: "Muziek maakt de viering compleet, zeker als er gedanst gaat worden." },
    { categoryKey: "photography", priority: "recommended", weight: 2, rationale: "Dit soort mijlpalen wil je graag kunnen terugkijken." },
    { categoryKey: "cake", priority: "recommended", weight: 1, rationale: "Een taart is een mooi symbolisch onderdeel van een jubileum." },
  ],
  christmas_party: [
    { categoryKey: "venue", priority: "recommended", weight: 3, rationale: "Een sfeervolle locatie past bij de kerstsfeer." },
    { categoryKey: "catering", priority: "essential", weight: 4, rationale: "Een kerstborrel of -diner draait om lekker eten en drinken." },
    { categoryKey: "dj_music", priority: "recommended", weight: 2, rationale: "Muziek zorgt voor sfeer tijdens de borrel of het feest." },
    { categoryKey: "decoration", priority: "recommended", weight: 2, rationale: "Kerstdecoratie maakt de setting direct herkenbaar." },
    { categoryKey: "photography", priority: "optional", weight: 1, rationale: "Leuk om dit moment met collega's vast te leggen." },
    { categoryKey: "av_equipment", priority: "optional", weight: 1, rationale: "Handig als er een kort programma of speech gepland is." },
  ],
  new_year_party: [
    { categoryKey: "venue", priority: "recommended", weight: 3, rationale: "Een geschikte locatie is nodig om tot na middernacht te vieren." },
    { categoryKey: "catering", priority: "essential", weight: 3, rationale: "Eten en drinken horen bij een nieuwjaarsfeest tot in de vroege uurtjes." },
    { categoryKey: "dj_music", priority: "essential", weight: 3, rationale: "Muziek is onmisbaar rondom de aftelmomenten en het feest zelf." },
    { categoryKey: "lighting_sound", priority: "recommended", weight: 2, rationale: "Licht en geluid maken het middernacht-moment extra memorabel." },
    { categoryKey: "decoration", priority: "recommended", weight: 1, rationale: "Feestelijke decoratie versterkt de nieuwjaarssfeer." },
    { categoryKey: "security", priority: "optional", weight: 1, rationale: "Bij grotere feesten met vuurwerk of alcohol is beveiliging soms verstandig." },
  ],
  corporate_party: [
    { categoryKey: "venue", priority: "essential", weight: 4, rationale: "Een passende zakelijke locatie is de basis voor een bedrijfsfeest." },
    { categoryKey: "catering", priority: "essential", weight: 3, rationale: "Catering is een vast onderdeel van vrijwel elk bedrijfsevenement." },
    { categoryKey: "av_equipment", priority: "recommended", weight: 2, rationale: "Handig voor een eventueel presentatiegedeelte of speeches." },
    { categoryKey: "dj_music", priority: "recommended", weight: 2, rationale: "Muziek maakt van een borrel een echt feest." },
    { categoryKey: "photography", priority: "recommended", weight: 1, rationale: "Fijn materiaal voor interne communicatie en sociale media." },
    { categoryKey: "staffing", priority: "recommended", weight: 1, rationale: "Extra bedienend personeel houdt het event soepel lopend." },
    { categoryKey: "transport", priority: "optional", weight: 1, rationale: "Relevant als medewerkers vanaf kantoor vervoerd moeten worden." },
  ],
  baby_shower: [
    { categoryKey: "catering", priority: "essential", weight: 3, rationale: "Hapjes en drankjes horen bij een gezellige babyshower." },
    { categoryKey: "decoration", priority: "essential", weight: 2, rationale: "Decoratie is vaak het hart van een babyshower-thema." },
    { categoryKey: "cake", priority: "recommended", weight: 1, rationale: "Een taart is een populair onderdeel van een babyshower." },
    { categoryKey: "photography", priority: "optional", weight: 1, rationale: "Leuk om deze bijzondere fase later terug te kunnen zien." },
    { categoryKey: "entertainment", priority: "optional", weight: 1, rationale: "Spelletjes of entertainment maken de middag extra gezellig." },
  ],
  bachelor_party: [
    { categoryKey: "venue", priority: "recommended", weight: 2, rationale: "Een geschikte locatie of activiteit vormt de basis van de dag/avond." },
    { categoryKey: "catering", priority: "recommended", weight: 2, rationale: "Eten en drinken houden de groep energie erin." },
    { categoryKey: "entertainment", priority: "recommended", weight: 2, rationale: "Activiteiten of entertainment maken het vrijgezellenfeest memorabel." },
    { categoryKey: "transport", priority: "optional", weight: 1, rationale: "Relevant bij meerdere locaties of alcohol tijdens het feest." },
    { categoryKey: "dj_music", priority: "optional", weight: 1, rationale: "Muziek maakt het feestgedeelte compleet." },
  ],
  festival: [
    { categoryKey: "venue", priority: "essential", weight: 4, rationale: "Een geschikt terrein of locatie is de basis van een festival." },
    { categoryKey: "av_equipment", priority: "essential", weight: 3, rationale: "Podium- en geluidstechniek zijn essentieel voor optredens." },
    { categoryKey: "lighting_sound", priority: "essential", weight: 3, rationale: "Licht en geluid bepalen de sfeer en kwaliteit van de shows." },
    { categoryKey: "security", priority: "essential", weight: 3, rationale: "Bij publieksevenementen is beveiliging noodzakelijk voor veiligheid." },
    { categoryKey: "staffing", priority: "essential", weight: 2, rationale: "Voldoende personeel is nodig voor bars, entree en coördinatie." },
    { categoryKey: "catering", priority: "recommended", weight: 2, rationale: "Eten- en drankvoorzieningen verhogen de bezoekerstevredenheid." },
    { categoryKey: "entertainment", priority: "recommended", weight: 2, rationale: "Extra acts en activiteiten verrijken het programma." },
    { categoryKey: "cleaning", priority: "recommended", weight: 1, rationale: "Schoonmaak tijdens en na afloop is nodig bij grotere bezoekersaantallen." },
  ],
  graduation_party: [
    { categoryKey: "catering", priority: "essential", weight: 3, rationale: "Eten en drinken vormen de basis van een afstudeerfeest." },
    { categoryKey: "dj_music", priority: "recommended", weight: 2, rationale: "Muziek maakt er een echt feest van." },
    { categoryKey: "decoration", priority: "recommended", weight: 1, rationale: "Decoratie versterkt het feestelijke karakter van de mijlpaal." },
    { categoryKey: "furniture_rental", priority: "recommended", weight: 1, rationale: "Extra zitplaatsen zijn vaak nodig voor familie en vrienden." },
    { categoryKey: "photography", priority: "optional", weight: 1, rationale: "Leuk om deze mijlpaal vast te leggen." },
  ],
  dinner: [
    { categoryKey: "catering", priority: "essential", weight: 4, rationale: "Het diner zelf is de kern van dit evenement." },
    { categoryKey: "venue", priority: "recommended", weight: 2, rationale: "Een passende ruimte verhoogt de beleving van het diner." },
    { categoryKey: "furniture_rental", priority: "optional", weight: 1, rationale: "Relevant als je meer gasten hebt dan je eigen tafel en stoelen aankan." },
    { categoryKey: "decoration", priority: "optional", weight: 1, rationale: "Tafelstyling maakt het diner net wat feestelijker." },
  ],
  garden_party: [
    { categoryKey: "catering", priority: "essential", weight: 3, rationale: "Eten en drinken zijn de basis van een tuinfeest." },
    { categoryKey: "furniture_rental", priority: "essential", weight: 2, rationale: "Buiten zitten vraagt om voldoende tafels en stoelen." },
    { categoryKey: "tent_rental", priority: "recommended", weight: 2, rationale: "Een tent biedt bescherming tegen regen of felle zon." },
    { categoryKey: "decoration", priority: "recommended", weight: 1, rationale: "Decoratie maakt de tuin extra feestelijk." },
    { categoryKey: "dj_music", priority: "optional", weight: 1, rationale: "Achtergrondmuziek zet de sfeer neer." },
  ],
  kids_party: [
    { categoryKey: "entertainment", priority: "essential", weight: 3, rationale: "Entertainment houdt kinderen vermaakt tijdens het hele feest." },
    { categoryKey: "cake", priority: "essential", weight: 1, rationale: "Een taart is bij een kinderfeestje vrijwel altijd onmisbaar." },
    { categoryKey: "catering", priority: "recommended", weight: 2, rationale: "Kindvriendelijke hapjes en drinken maken het feest compleet." },
    { categoryKey: "decoration", priority: "recommended", weight: 1, rationale: "Kleurrijke decoratie maakt het feest extra speciaal voor de kinderen." },
    { categoryKey: "photobooth", priority: "optional", weight: 1, rationale: "Een leuke, actieve attractie voor de kinderen." },
  ],
  cultural_event: [
    { categoryKey: "venue", priority: "essential", weight: 3, rationale: "Een passende ruimte is nodig voor de festiviteit en het aantal gasten." },
    { categoryKey: "catering", priority: "essential", weight: 3, rationale: "Eten speelt vaak een centrale, symbolische rol bij dit soort festiviteiten." },
    { categoryKey: "decoration", priority: "recommended", weight: 2, rationale: "Passende decoratie versterkt de betekenis en sfeer van het moment." },
    { categoryKey: "entertainment", priority: "recommended", weight: 2, rationale: "Muziek of optredens horen vaak bij deze festiviteiten." },
    { categoryKey: "staffing", priority: "optional", weight: 1, rationale: "Extra hulp is prettig bij grotere gezelschappen." },
  ],
  business_conference: [
    { categoryKey: "venue", priority: "essential", weight: 4, rationale: "Een geschikte congreslocatie is de basis voor een zakelijk congres." },
    { categoryKey: "av_equipment", priority: "essential", weight: 3, rationale: "Presentaties en sprekers vragen om professionele AV-apparatuur." },
    { categoryKey: "catering", priority: "recommended", weight: 2, rationale: "Koffie, lunch en pauzeverzorging houden deelnemers scherp." },
    { categoryKey: "staffing", priority: "recommended", weight: 1, rationale: "Registratie en coördinatie vragen om voldoende personeel." },
    { categoryKey: "transport", priority: "optional", weight: 1, rationale: "Relevant bij meerdere locaties of internationale deelnemers." },
    { categoryKey: "photography", priority: "optional", weight: 1, rationale: "Handig voor verslaglegging en marketing na afloop." },
  ],
  product_launch: [
    { categoryKey: "venue", priority: "essential", weight: 3, rationale: "De locatie zet de toon voor de presentatie van je product." },
    { categoryKey: "av_equipment", priority: "essential", weight: 3, rationale: "Een overtuigende lancering vraagt om sterke audiovisuele ondersteuning." },
    { categoryKey: "photography", priority: "essential", weight: 2, rationale: "Beeldmateriaal is essentieel voor pers en marketing na de lancering." },
    { categoryKey: "videography", priority: "recommended", weight: 2, rationale: "Video versterkt het verhaal voor een groter online bereik." },
    { categoryKey: "lighting_sound", priority: "recommended", weight: 2, rationale: "Licht en geluid bepalen de impact van het lanceringsmoment." },
    { categoryKey: "catering", priority: "recommended", weight: 1, rationale: "Een goede borrel of lunch hoort bij het netwerken na afloop." },
    { categoryKey: "staffing", priority: "optional", weight: 1, rationale: "Extra hosts of hostessen verhogen de gastvrijheid." },
  ],
  private_party: [
    { categoryKey: "catering", priority: "recommended", weight: 3, rationale: "Eten en drinken vormen meestal de kern van een privéfeest." },
    { categoryKey: "dj_music", priority: "recommended", weight: 2, rationale: "Muziek maakt van een borrel al snel een echt feest." },
    { categoryKey: "decoration", priority: "optional", weight: 1, rationale: "Decoratie geeft het feest een persoonlijke touch." },
    { categoryKey: "furniture_rental", priority: "optional", weight: 1, rationale: "Relevant bij meer gasten dan je eigen meubilair aankan." },
  ],
  other: [
    { categoryKey: "venue", priority: "recommended", weight: 3, rationale: "Een passende locatie is meestal een van de eerste keuzes." },
    { categoryKey: "catering", priority: "recommended", weight: 3, rationale: "Eten en drinken zijn bij de meeste evenementen een basisbehoefte." },
    { categoryKey: "decoration", priority: "optional", weight: 1, rationale: "Decoratie maakt je evenement net wat feestelijker." },
  ],
};

export function getTemplateForType(type: EventType): Template[] {
  return TEMPLATES[type] ?? TEMPLATES.other;
}

export function buildDefaultRequirements(event: EventCore): RequirementCategory[] {
  const rawTemplate = getTemplateForType(event.type);
  // FIX (gemeld aug. 2026): een organisator die al aangaf het evenement bij
  // zichzelf thuis te houden ("locatieType" = "home") kreeg via deze
  // mock-fallback tóch een "venue"-categorie voorgesteld — er hoeft dan
  // geen locatie gehuurd te worden. Dezelfde deterministische logica die de
  // echte AI nu ook krijgt (zie REQUIREMENT_GENERATOR_PROMPT).
  const template = event.locationType === "home" ? rawTemplate.filter((t) => t.categoryKey !== "venue") : rawTemplate;
  const totalBudget = event.budget?.totalCents ?? null;
  // HERONTWERP (gemeld door Cem, aug. 2026): "ik wil dat je het budget
  // enkel verdeeld over de essentiële en belangrijke zaken... de nice to
  // haves moet je geen budget geven totdat een gebruiker zelf aangeeft dit
  // in het plan mee te nemen" — bv. €1.000 → 200-200-500-100, exact
  // verdeeld over essential+recommended, niets "gereserveerd" voor een
  // optionele categorie die nog niet eens in het plan zit. Vóór deze fix
  // telde `totalWeight` het gewicht van ALLE categorieën mee, inclusief
  // "optional" (die toch al standaard niet geselecteerd is, zie
  // `selected` hieronder) — essential/recommended kregen daardoor nooit
  // het volledige budget. Nu telt de noemer alleen het gewicht van
  // essential+recommended, en optional krijgt altijd expliciet €0 (geen
  // verdund gewicht-aandeel, geen `TYPICAL_CATEGORY_COST_CENTS`-fallback)
  // — pas zodra de organisator 'm zelf op de planpagina aanzet én de
  // schuif optrekt (RequirementToggle + het envelope-model in
  // lib/budget-allocator.ts) krijgt zo'n categorie een echt bedrag, en dat
  // trekt dan bewust van een andere categorie af, want de pot is bij
  // oplevering al volledig verdeeld.
  const allocatableTemplate = template.filter((t) => t.priority !== "optional");
  const totalWeight = allocatableTemplate.reduce((sum, t) => sum + t.weight, 0);

  return template.map((t) => ({
    id: uid("reqc"),
    eventId: event.id,
    categoryKey: t.categoryKey,
    label: SUPPLIER_CATEGORY_LABELS[t.categoryKey],
    priority: t.priority,
    aiRationale: t.rationale,
    selected: t.priority !== "optional",
    estimatedBudgetCents:
      t.priority === "optional"
        ? 0
        : totalBudget
          ? Math.round((t.weight / totalWeight) * totalBudget)
          : // Zonder totaalbudget: val terug op de typische marktprijs voor
            // die categorie i.p.v. simpelweg `null` — zo heeft het
            // budgetoverzicht altijd een realistische schatting, ook
            // vóórdat de organisator zelf een totaalbudget heeft opgegeven.
            TYPICAL_CATEGORY_COST_CENTS[t.categoryKey] ?? null,
    draftMessage: null,
    status: "suggested",
  }));
}

export function priorityRank(p: RequirementPriority) {
  return priorityWeight[p];
}

/**
 * Zorgt dat de door de AI voorgestelde categoriebudgetten nooit boven het
 * daadwerkelijke totaalbudget van de organisator uitkomen — ongeacht wat het
 * taalmodel zelf aan schattingen teruggeeft.
 *
 * BUG (gemeld aug. 2026): een organisator met een budget van €500 kreeg een
 * AI-plan met een totaal van ruim €4.400 — de systeeminstructie vraagt het
 * model al om schattingen "ongeveer" het totaalbudget te laten benaderen,
 * maar dat is bij een taalmodel nooit een garantie (zeker niet bij een klein
 * budget t.o.v. realistische Nederlandse marktprijzen). Deze functie is het
 * harde vangnet daarachter: ligt de som van de geselecteerde categorieën
 * boven het opgegeven totaalbudget, dan wordt elke schatting naar
 * verhouding omlaag geschaald zodat de som weer exact op het totaalbudget
 * uitkomt — dezelfde proportionele aanpak als `buildDefaultRequirements`
 * hierboven. Blijft de AI toevallig al onder budget, dan gebeurt er niets:
 * dat is geen fout, dat is ruimte over. Staat hier (i.p.v. in
 * lib/ai/planning.ts, waar hij gebruikt wordt) omdat dit bestand geen
 * "server-only" importeert — geldberekeningen als deze horen daarom bij de
 * losstaande logica die vitest wél kan testen (zie vitest.config.ts).
 */
export function capEstimatesToBudget<T extends { selected: boolean; priority: RequirementPriority; estimatedBudgetCents: number | null }>(
  categories: T[],
  totalBudgetCents: number | null | undefined
): T[] {
  if (!totalBudgetCents || totalBudgetCents <= 0) return categories;
  // "optional" categorieën horen altijd op €0 te staan (zie
  // buildDefaultRequirements hierboven) en tellen dus sowieso niet mee in
  // de som — expliciet uitgesloten hier ook, i.p.v. daar alleen op te
  // vertrouwen, zodat deze functie zelf ook correct blijft als er ooit een
  // ander pad is dat die garantie niet geeft (zelfde "nooit alleen op één
  // plek afdwingen"-aanpak als MAX_PLAUSIBLE_CATEGORY_BUDGET_CENTS hierboven).
  const selectedSum = categories
    .filter((c) => c.selected && c.priority !== "optional")
    .reduce((sum, c) => sum + (c.estimatedBudgetCents ?? 0), 0);
  if (selectedSum <= totalBudgetCents) return categories;

  const factor = totalBudgetCents / selectedSum;
  return categories.map((c) =>
    c.priority !== "optional" && c.estimatedBudgetCents != null ? { ...c, estimatedBudgetCents: Math.round(c.estimatedBudgetCents * factor) } : c
  );
}
