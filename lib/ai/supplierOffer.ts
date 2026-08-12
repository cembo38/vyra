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

function mockParse(description: string): StructuredSupplierOffer {
  const priceMatch = description.match(/€\s?([\d.,]+)|([\d.,]+)\s?euro/i);
  let totalPriceCents: number | null = null;
  if (priceMatch) {
    const raw = (priceMatch[1] ?? priceMatch[2] ?? "").replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) totalPriceCents = Math.round(parsed * 100);
  }

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

export async function parseSupplierOfferDescription(description: string) {
  return callStructuredAI<StructuredSupplierOffer>({
    role: "supplier_response_assistant",
    system: SUPPLIER_RESPONSE_ASSISTANT_PROMPT,
    user: `Beschrijving van de leverancier: """${description}"""`,
    schema: SCHEMA,
    schemaName: "supplier_offer",
    mockFallback: () => mockParse(description),
  });
}
