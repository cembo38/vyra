import "server-only";
import { callStructuredAI } from "@/lib/ai/client";
import { EVENT_ANALYST_PROMPT, QUESTION_GENERATOR_PROMPT } from "@/lib/ai/prompts";
import { AiInterviewMessage, EventCore, EventType, EVENT_TYPE_LABELS } from "@/lib/types";
import { MAX_INTERVIEW_QUESTIONS } from "@/lib/config";

/* ------------------------------------------------------------------ */
/* Event Understanding AI                                              */
/* ------------------------------------------------------------------ */

export interface ExtractedEventFields {
  eventType: EventType | null;
  eventName: string | null;
  guestCountAdults: number | null;
  guestCountChildren: number | null;
  locationLabel: string | null;
  // "tbd" (nog te bepalen) toegevoegd naast de EventCore-waarde "home"/
  // "external_venue" — precies het geval waarin iemand expliciet aangeeft
  // nog geen locatie te hebben (zie mockExtractEventFields en spec-item
  // #57). Zonder deze waarde bleef dat antwoord altijd onherkenbaar `null`.
  locationType: "home" | "external_venue" | "tbd" | null;
  indoorOutdoor: "indoor" | "outdoor" | "both" | null;
  monthHint: string | null;
  budgetCents: number | null;
  formality: "casual" | "semi_formal" | "formal" | null;
  style: string | null;
  isProfessional: boolean | null;
}

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    eventType: { type: ["string", "null"], enum: [...Object.keys(EVENT_TYPE_LABELS), null] },
    eventName: { type: ["string", "null"] },
    guestCountAdults: { type: ["number", "null"] },
    guestCountChildren: { type: ["number", "null"] },
    locationLabel: { type: ["string", "null"] },
    locationType: { type: ["string", "null"], enum: ["home", "external_venue", "tbd", null] },
    indoorOutdoor: { type: ["string", "null"], enum: ["indoor", "outdoor", "both", null] },
    monthHint: { type: ["string", "null"] },
    budgetCents: { type: ["number", "null"] },
    formality: { type: ["string", "null"], enum: ["casual", "semi_formal", "formal", null] },
    style: { type: ["string", "null"] },
    isProfessional: { type: ["boolean", "null"] },
  },
  required: [
    "eventType", "eventName", "guestCountAdults", "guestCountChildren", "locationLabel", "locationType",
    "indoorOutdoor", "monthHint", "budgetCents", "formality", "style", "isProfessional",
  ],
};

const CITIES = ["Amsterdam", "Rotterdam", "Utrecht", "Den Haag", "Eindhoven", "Groningen", "Haarlem", "Tilburg", "Almere", "Breda", "Nijmegen", "Amstelveen", "Zaandam", "Leiden", "Maastricht"];
const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/**
 * Volgorde is bewust belangrijk: dit is de EERSTE match die wint (zie de
 * loop in mockExtractEventFields hieronder), dus een generieke regel die
 * toevallig ook op een zakelijke variant past moet NA de specifiekere
 * zakelijke regel staan. Twee concrete bugs die zo aan het licht kwamen
 * bij een QA-simulatie (spec-item #57, testronde met AI-persona's):
 * - "kerstborrel voor het personeel, 75 medewerkers" werd door de generieke
 *   /kerst/i van "christmas_party" al afgevangen VOORDAT "corporate_party"
 *   (die specifiek al op "medewerkers"/"collega" checkt) ooit aan de beurt
 *   kwam — een zeer voor de hand liggende manier waarop mensen een
 *   bedrijfskerstborrel beschrijven werd zo als privé-kerstfeest
 *   geclassificeerd, met als gevolg: verkeerde bonusvragen (geen AV-
 *   apparatuur/vervoer-vraag) en een categorieënsjabloon zonder
 *   AV-apparatuur, terwijl de organisator daar expliciet om vroeg.
 *   Zelfde risico geldt voor "nieuwjaarsborrel (van het bedrijf)", dus
 *   "corporate_party" staat nu ook vóór "new_year_party".
 * - "kinderfeest(je)" ving alleen de letterlijke term af, terwijl de
 *   meeste ouders het gewoon "verjaardagsfeestje voor mijn dochter/zoon"
 *   noemen — dat viel dan door naar het generieke "birthday"-sjabloon,
 *   dat geen "entertainment"-categorie bevat (wél het sjabloon van
 *   "kids_party"), waardoor een leverancier als een kinderentertainer
 *   structureel NOOIT een aanvraag kreeg voor exact dit soort feestjes.
 */
const TYPE_KEYWORDS: [EventType, RegExp][] = [
  ["wedding", /bruiloft|trouw(en|erij)?|huwelijk/i],
  ["baby_shower", /babyshower|baby.?shower/i],
  ["bachelor_party", /vrijgezellenfeest|vrijgezellen/i],
  ["graduation_party", /afstudeer|afgestudeerd/i],
  ["anniversary", /jubileum/i],
  ["kids_party", /kinderfeest(je)?|(dochter|zoon|kindje|kleintje|kids?).{0,40}(verjaardag\w*|jarig)|(verjaardag\w*|jarig).{0,40}(dochter|zoon|kindje|kleintje)/i],
  ["garden_party", /tuinfeest/i],
  ["festival", /festival/i],
  ["business_conference", /congres|conferentie/i],
  ["product_launch", /productlancering|lancering/i],
  ["corporate_party", /bedrijfsfeest|kerstborrel.*bedrijf|collega|medewerkers|zakelijk feest/i],
  ["christmas_party", /kerst/i],
  ["new_year_party", /nieuwjaar/i],
  ["cultural_event", /religieus|cultureel|festiviteit/i],
  ["birthday", /verjaardag|jarig|verjaring/i],
  ["dinner", /diner|etentje/i],
  ["private_party", /private party|privéfeest/i],
];

function mockExtractEventFields(description: string): ExtractedEventFields {
  const text = description;

  let eventType: EventType | null = null;
  for (const [type, re] of TYPE_KEYWORDS) {
    if (re.test(text)) {
      eventType = type;
      break;
    }
  }

  const guestMatch = text.match(/(\d{1,4})\s*(gasten|mensen|personen|man|medewerkers|collega'?s)/i);
  const guestCountAdults = guestMatch ? parseInt(guestMatch[1], 10) : null;

  const locationLabel = CITIES.find((c) => text.toLowerCase().includes(c.toLowerCase())) ?? null;

  // Budget-parsing — twee concrete misparses kwamen naar boven in de
  // QA-simulatie (spec-item #57):
  // 1. "€150 per persoon" werd als TOTAALbudget van €150 opgeslagen (i.p.v.
  //    €150 × het aantal gasten), wat bij 75 gasten een absurd laag
  //    "totaalbudget" van €150 opleverde dat vervolgens ook de
  //    categoriebudgetten volledig scheeftrok. We kennen het aantal gasten
  //    op dit punt niet betrouwbaar (elk bericht wordt los geëxtraheerd),
  //    dus omrekenen kan hier niet veilig — we laten het veld daarom
  //    bewust leeg in plaats van een bedrag op te slaan dat gegarandeerd
  //    fout is. Beter zichtbaar "onbekend" dan onzichtbaar fout.
  // 2. "20 duizend euro" (heel gangbare manier om een rond bedrag in de
  //    duizenden uit te drukken) werd helemaal niet herkend, omdat de
  //    euro-regex een bedrag direct vóór "euro" verwacht — "duizend"
  //    ertussen brak de match. Nu expliciet ondersteund.
  const perPersonPattern = /per\s?(persoon|hoofd|gast|deelnemer)|\bp\.?p\.?\b/i;
  const thousandMatch = text.match(/([\d.,]+)\s*duizend\s*euro/i);
  const budgetMatch = text.match(/€\s?([\d.,]+)|([\d.,]+)\s?euro/i);
  let budgetCents: number | null = null;
  if (perPersonPattern.test(text)) {
    budgetCents = null;
  } else if (thousandMatch) {
    const raw = thousandMatch[1].replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) budgetCents = Math.round(parsed * 1000 * 100);
  } else if (budgetMatch) {
    const raw = (budgetMatch[1] ?? budgetMatch[2] ?? "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) budgetCents = Math.round(parsed * 100);
  }

  const monthHint = MONTHS.find((m) => text.toLowerCase().includes(m)) ?? null;

  const formalityFormalWords = /luxe|chic|formeel|elegant|statig/i;
  const formalityCasualWords = /relaxed|casual|informeel|gezellig|los/i;
  const formality = formalityFormalWords.test(text) ? "formal" : formalityCasualWords.test(text) ? "casual" : null;

  const isProfessional = /bedrijf|collega|medewerkers|kantoor|zakelijk/i.test(text) ? true : eventType === "wedding" || eventType === "birthday" ? false : null;

  // "nog geen locatie" e.d. viel voorheen door naar `null` (= "onbekend"),
  // precies hetzelfde alsof de vraag nooit gesteld was — waardoor de vraag
  // niet opnieuw gesteld werd (al "gevraagd") maar het antwoord ook nooit
  // vastgelegd werd. `locationType` heeft juist een aparte "tbd"-waarde
  // voor precies dit geval ("nog te bepalen") — die stond er al in het
  // type, maar werd door de mock-extractie nooit gezet.
  const locationType = /thuis|bij (mij|ons) thuis|in de tuin/i.test(text)
    ? "home"
    : /geen locatie|nog (geen|niks|niets)|nul locaties|nog te (bepalen|zoeken|kiezen)|weet.*nog niet.*locatie|locatie.*weet.*nog niet/i.test(text)
      ? "tbd"
      : null;
  const indoorOutdoor = /tuin|buiten/i.test(text) ? "outdoor" : /binnen|zaal/i.test(text) ? "indoor" : null;

  return {
    eventType,
    eventName: null,
    guestCountAdults,
    guestCountChildren: null,
    locationLabel,
    locationType,
    indoorOutdoor,
    monthHint,
    budgetCents,
    formality,
    style: null,
    isProfessional,
  };
}

export async function extractEventFields(description: string, context?: { userId?: string | null; eventId?: string | null }) {
  return callStructuredAI<ExtractedEventFields>({
    role: "event_understanding",
    system: EVENT_ANALYST_PROMPT,
    user: `Beschrijving van de gebruiker:\n"""${description}"""`,
    schema: EXTRACT_SCHEMA,
    schemaName: "extracted_event_fields",
    mockFallback: () => mockExtractEventFields(description),
    context,
  });
}

/* ------------------------------------------------------------------ */
/* Question Generator AI                                               */
/* ------------------------------------------------------------------ */

export interface NextQuestionResult {
  question: string | null;
  done: boolean;
}

const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    question: { type: ["string", "null"] },
    done: { type: "boolean" },
  },
  required: ["question", "done"],
};

const BONUS_QUESTIONS: Partial<Record<EventType, string[]>> = {
  wedding: ["Wil je een weddingplanner die je helpt met de coördinatie, of regel je dit liever zelf?", "Wil je entertainment zoals live muziek of een DJ, en denk je ook aan bloemstukken en decoratie?"],
  birthday: ["Wil je catering, of regel je het eten liever zelf?", "Heb je al gedacht aan muziek of een DJ, en wil je decoratie voor de locatie?"],
  corporate_party: ["Moet er een presentatiegedeelte zijn met audiovisuele apparatuur?", "Moet er vervoer geregeld worden voor medewerkers?"],
  kids_party: ["Zijn er speciale wensen voor entertainment, zoals een grimeur of springkussen?"],
  business_conference: ["Hoeveel sprekers of sessies verwacht je ongeveer, en is livestreaming gewenst?"],
  product_launch: ["Wil je pers en influencers uitnodigen, en is een fotograaf of videograaf gewenst?"],
};

const DEFAULT_BONUS = ["Zijn er nog specifieke wensen — bijvoorbeeld rond eten, muziek, decoratie of entertainment — die ik moet weten?"];

function isFieldKnown(v: unknown) {
  return v !== null && v !== undefined && v !== "";
}

function mockNextQuestion(event: EventCore, history: AiInterviewMessage[]): NextQuestionResult {
  const askedTexts = new Set(history.filter((m) => m.role === "assistant").map((m) => m.text));

  const coreChecks: { known: boolean; question: string }[] = [
    { known: isFieldKnown(event.guestCountAdults), question: "Hoeveel gasten verwacht je ongeveer, in totaal?" },
    { known: isFieldKnown(event.locationLabel), question: "In welke plaats of regio gaat het evenement plaatsvinden?" },
    {
      known: isFieldKnown(event.locationType),
      question: event.type === "birthday" || event.type === "garden_party" || event.type === "kids_party"
        ? "Is het bij jou thuis, of zoek je een externe locatie?"
        : "Heb je al een locatie op het oog, of mag ik daar rekening mee houden dat we die nog gaan zoeken?",
    },
    { known: isFieldKnown(event.date) || isFieldKnown(event.monthHint), question: "Wat is de gewenste datum, of in ieder geval de gewenste maand?" },
    { known: isFieldKnown(event.formality), question: "Wil je een formele of juist een informele sfeer?" },
    { known: isFieldKnown(event.budget?.totalCents), question: "Wat is ongeveer je totale budget voor dit evenement?" },
  ];

  const nextCore = coreChecks.find((c) => !c.known && !askedTexts.has(c.question));
  if (nextCore) return { question: nextCore.question, done: false };

  const bonusList = BONUS_QUESTIONS[event.type] ?? DEFAULT_BONUS;
  const nextBonus = bonusList.find((q) => !askedTexts.has(q));
  if (nextBonus) return { question: nextBonus, done: false };

  return { question: null, done: true };
}

export async function generateNextQuestion(event: EventCore, history: AiInterviewMessage[]) {
  // Harde grens (spec-item #56, gemeld: "er komt maar geen einde aan de
  // vragen") — los van wat de AI zelf zou beslissen, stopt het interview
  // sowieso zodra MAX_INTERVIEW_QUESTIONS al gestelde vragen zijn bereikt.
  // Geteld aan de hand van de al opgeslagen berichtgeschiedenis, dus dit
  // geldt hetzelfde voor zowel de echte AI als de mock-fallback. Bewust vóór
  // de AI-aanroep gecontroleerd: bij de grens is er ook geen wachttijd/
  // API-kosten meer nodig voor een antwoord dat toch wordt genegeerd.
  const askedCount = history.filter((m) => m.role === "assistant").length;
  if (askedCount >= MAX_INTERVIEW_QUESTIONS) {
    return { data: { question: null, done: true }, usedAI: false };
  }

  const known = {
    type: EVENT_TYPE_LABELS[event.type],
    guestCountAdults: event.guestCountAdults,
    guestCountChildren: event.guestCountChildren,
    location: event.locationLabel,
    locationType: event.locationType,
    date: event.date,
    monthHint: event.monthHint,
    formality: event.formality,
    budget: event.budget?.totalCents,
    style: event.style,
  };
  return callStructuredAI<NextQuestionResult>({
    role: "question_generator",
    system: QUESTION_GENERATOR_PROMPT,
    user: `Eventtype: ${EVENT_TYPE_LABELS[event.type]}\nAl bekende gegevens: ${JSON.stringify(known)}\nGespreksgeschiedenis: ${JSON.stringify(history.map((m) => ({ role: m.role, text: m.text })))}\n\nStel de volgende beste vervolgvraag, of geef aan dat we klaar zijn.`,
    schema: QUESTION_SCHEMA,
    schemaName: "next_question",
    mockFallback: () => mockNextQuestion(event, history),
    context: { userId: event.ownerId, eventId: event.id },
  });
}
