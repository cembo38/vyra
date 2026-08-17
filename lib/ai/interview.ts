import "server-only";
import { callStructuredAI } from "@/lib/ai/client";
import { EVENT_ANALYST_PROMPT, QUESTION_GENERATOR_PROMPT } from "@/lib/ai/prompts";
import { AiInterviewMessage, EventCore, EventType, EVENT_TYPE_LABELS } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Event Understanding AI                                              */
/* ------------------------------------------------------------------ */

export interface ExtractedEventFields {
  eventType: EventType | null;
  eventName: string | null;
  guestCountAdults: number | null;
  guestCountChildren: number | null;
  locationLabel: string | null;
  locationType: "home" | "external_venue" | null;
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
    locationType: { type: ["string", "null"], enum: ["home", "external_venue", null] },
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

const TYPE_KEYWORDS: [EventType, RegExp][] = [
  ["wedding", /bruiloft|trouw(en|erij)?|huwelijk/i],
  ["baby_shower", /babyshower|baby.?shower/i],
  ["bachelor_party", /vrijgezellenfeest|vrijgezellen/i],
  ["graduation_party", /afstudeer|afgestudeerd/i],
  ["christmas_party", /kerst/i],
  ["new_year_party", /nieuwjaar/i],
  ["anniversary", /jubileum/i],
  ["kids_party", /kinderfeest|kinderfeestje/i],
  ["garden_party", /tuinfeest/i],
  ["festival", /festival/i],
  ["business_conference", /congres|conferentie/i],
  ["product_launch", /productlancering|lancering/i],
  ["corporate_party", /bedrijfsfeest|kerstborrel.*bedrijf|collega|medewerkers|zakelijk feest/i],
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

  const budgetMatch = text.match(/€\s?([\d.,]+)|([\d.,]+)\s?euro/i);
  let budgetCents: number | null = null;
  if (budgetMatch) {
    const raw = (budgetMatch[1] ?? budgetMatch[2] ?? "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) budgetCents = Math.round(parsed * 100);
  }

  const monthHint = MONTHS.find((m) => text.toLowerCase().includes(m)) ?? null;

  const formalityFormalWords = /luxe|chic|formeel|elegant|statig/i;
  const formalityCasualWords = /relaxed|casual|informeel|gezellig|los/i;
  const formality = formalityFormalWords.test(text) ? "formal" : formalityCasualWords.test(text) ? "casual" : null;

  const isProfessional = /bedrijf|collega|medewerkers|kantoor|zakelijk/i.test(text) ? true : eventType === "wedding" || eventType === "birthday" ? false : null;

  const locationType = /thuis|bij (mij|ons) thuis|in de tuin/i.test(text) ? "home" : null;
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
