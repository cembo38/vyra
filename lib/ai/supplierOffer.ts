import "server-only";
import { callStructuredAI, callFreeTextAI } from "@/lib/ai/client";
import { SUPPLIER_RESPONSE_ASSISTANT_PROMPT, SUPPLIER_OFFER_WRITER_PROMPT } from "@/lib/ai/prompts";
import { StructuredSupplierOffer, mockParseOfferDescription, mockWriteOfferText } from "@/lib/ai/supplierOfferMock";

export type { StructuredSupplierOffer };

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

export async function parseSupplierOfferDescription(description: string, context?: { userId?: string | null; eventId?: string | null }) {
  return callStructuredAI<StructuredSupplierOffer>({
    role: "supplier_response_assistant",
    system: SUPPLIER_RESPONSE_ASSISTANT_PROMPT,
    user: `Beschrijving van de leverancier: """${description}"""`,
    schema: SCHEMA,
    schemaName: "supplier_offer",
    mockFallback: () => mockParseOfferDescription(description),
    context,
  });
}

/**
 * Offertehulp (Pro+, spec-item #57) — de OMGEKEERDE richting van
 * parseSupplierOfferDescription hierboven: van een korte, stenografische
 * omschrijving naar een volledige, leesbare offertetekst die de leverancier
 * nog zelf controleert/aanpast in SupplierOfferForm.tsx voordat hij 'm (via
 * de bestaande "Genereer offerte-voorstel"-knop) laat structureren en
 * verstuurt.
 */
export async function writeSupplierOfferText(
  shorthand: string,
  context?: { userId?: string | null; eventId?: string | null }
): Promise<{ text: string; usedAI: boolean }> {
  const aiAnswer = await callFreeTextAI({
    role: "supplier_offer_writer",
    system: SUPPLIER_OFFER_WRITER_PROMPT,
    user: `Stenografische omschrijving van de leverancier: """${shorthand}"""`,
    context,
  });
  if (aiAnswer) return { text: aiAnswer, usedAI: true };
  return { text: mockWriteOfferText(shorthand), usedAI: false };
}
