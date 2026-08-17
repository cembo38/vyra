import { EventCore, EventType, RequirementCategory, RequirementPriority, SupplierCategory, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { uid } from "@/lib/utils";

export const ALL_SUPPLIER_CATEGORIES = Object.keys(SUPPLIER_CATEGORY_LABELS) as SupplierCategory[];

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
  const template = getTemplateForType(event.type);
  const totalBudget = event.budget?.totalCents ?? null;
  const totalWeight = template.reduce((sum, t) => sum + t.weight, 0);

  return template.map((t) => ({
    id: uid("reqc"),
    eventId: event.id,
    categoryKey: t.categoryKey,
    label: SUPPLIER_CATEGORY_LABELS[t.categoryKey],
    priority: t.priority,
    aiRationale: t.rationale,
    selected: t.priority !== "optional",
    estimatedBudgetCents: totalBudget ? Math.round((t.weight / totalWeight) * totalBudget) : null,
    draftMessage: null,
    status: "suggested",
  }));
}

export function priorityRank(p: RequirementPriority) {
  return priorityWeight[p];
}
