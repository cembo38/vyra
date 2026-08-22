import "server-only";
import { callStructuredAI } from "@/lib/ai/client";
import { SUPPLIER_RESPONSE_ASSISTANT_PROMPT } from "@/lib/ai/prompts";

export interface StructuredSupplierOffer {
  totalPriceCents: number | null;
  includes: string[];
  excludes: string[];
  staffIncluded: boolean;
  deliveryIncluded: boolean;
  setupIncluded: boolean;
  remarks: string | null;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    totalPriceCents: { type: ["number", "null"] },
    includes: { type: "array", items: { type: "string" } },
    excludes: { type: "array", items: { type: "string" } },
    staffIncluded: { type: "boolean" },
    deliveryIncluded: { type: "boolean" },
    setupIncluded: { type: "boolean" },
    remarks: { type: ["string", "null"] },
  },
  required: ["totalPriceCents", "includes", "excludes", "staffIncluded", "deliveryIncluded", "setupIncluded", "remarks"],
};

/**
 * Pakt van alle in de tekst genoemde bedragen het bedrag dat het meest
 * waarschijnlijk de ECHTE offerteprijs is — niet gewoon het eerste bedrag
 * dat voorkomt. Kwam uit een QA-simulatie met leverancier-persona's
 * (spec-item #57) naar voren: een leverancier reageert heel natuurlijk
 * eerst op het door de organisator genoemde budget ("46 euro voor 75
 * man? dat wordt 'm niet") vóórdat die zijn eigen, echte prijs noemt
 * ("...kom je dan al snel uit op zo'n 1500 tot 2000 euro totaal") — de
 * oude "pak het eerste bedrag"-aanpak sloeg dan het GENOEMDE (foute)
 * bedrag van de organisator op als offerteprijs van de leverancier, in
 * plaats van diens eigen prijs. We geven elk gevonden bedrag een score op
 * basis van de tekst eromheen: bedragen vlak bij "genoemd(e)/opgegeven/
 * budget van" (een verwijzing naar andermans bedrag) scoren lager,
 * bedragen vlak bij "totaal/all-in/kom ik uit op/offerte/prijs is" (een
 * eigen conclusie) scoren hoger. Bij gelijke score wint het hoogste
 * bedrag, want leveranciers noemen een te laag geacht bedrag vrijwel
 * altijd ter vergelijking, niet als eigen bod.
 */
function pickOfferAmountCents(description: string): number | null {
  const amountPattern = /€\s?([\d.,]+)|([\d.,]+)\s?euro/gi;
  const referenceContext = /genoemd|opgegeven|aangegeven|budget van|jullie budget|budget-indicatie/i;
  const quoteContext = /totaal|all-?in|kom\s+(ik|je|we)\s+(dan\s+)?uit|prijs is|reken(en)?\s+(ik|we)|offerte|voor (de hele groep|dit|deze)/i;

  let best: { cents: number; score: number } | null = null;
  for (const match of description.matchAll(amountPattern)) {
    const raw = match[1] ?? match[2] ?? "";
    const parsed = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(parsed)) continue;
    const cents = Math.round(parsed * 100);

    const contextStart = Math.max(0, (match.index ?? 0) - 40);
    const before = description.slice(contextStart, match.index ?? 0);
    const after = description.slice((match.index ?? 0), (match.index ?? 0) + 40);
    let score = 0;
    if (quoteContext.test(before) || quoteContext.test(after)) score += 2;
    if (referenceContext.test(before)) score -= 2;

    if (!best || score > best.score || (score === best.score && cents > best.cents)) {
      best = { cents, score };
    }
  }
  return best ? best.cents : null;
}

function mockParse(description: string): StructuredSupplierOffer {
  const totalPriceCents = pickOfferAmountCents(description);

  const includes: string[] = [];
  if (/personeel|bediening/i.test(description)) includes.push("Bediening / personeel");
  if (/levering|bezorg/i.test(description)) includes.push("Levering");
  if (/opbouw/i.test(description)) includes.push("Opbouw");
  if (/afbouw|ophalen/i.test(description)) includes.push("Afbouw");
  if (/vega|vegetarisch|vegan/i.test(description)) includes.push("Vegetarische/vegan opties");

  return {
    totalPriceCents,
    includes,
    excludes: [],
    staffIncluded: /personeel|bediening/i.test(description),
    deliveryIncluded: /levering|bezorg/i.test(description),
    setupIncluded: /opbouw/i.test(description),
    remarks: null,
  };
}

export async function parseSupplierOfferDescription(description: string, context?: { userId?: string | null; eventId?: string | null }) {
  return callStructuredAI<StructuredSupplierOffer>({
    role: "supplier_response_assistant",
    system: SUPPLIER_RESPONSE_ASSISTANT_PROMPT,
    user: `Beschrijving van de leverancier: """${description}"""`,
    schema: SCHEMA,
    schemaName: "supplier_offer",
    mockFallback: () => mockParse(description),
    context,
  });
}
