import "server-only";
import { callFreeTextAI } from "@/lib/ai/client";
import {
  SUPPLIER_ASSISTANT_PROMPT,
  SUPPLIER_REPLY_DRAFTER_PROMPT,
  SUPPLIER_PRIORITY_BRIEFING_PROMPT,
  SUPPLIER_PROFILE_TEXT_PROMPT,
} from "@/lib/ai/prompts";
import { serializeSupplierContext, mockSupplierAssistantAnswer, mockSupplierReplyDraft, mockSupplierBriefing, SupplierAssistantContext } from "@/lib/ai/supplierAssistantMock";

/**
 * VyrAI-assistent voor leveranciers (spec-item #57, aug. 2026) — het
 * spiegelbeeld van lib/ai/assistant.ts (de organisator-kant), maar dan met
 * leverancierscontext: openstaande aanvragen (leads), lopende/aankomende
 * boekingen (orders), verdiensten, en prestatie-inzichten. Zelfde
 * architectuur: callFreeTextAI() met mock-fallback, nooit een exception.
 * De context-serialisatie en mock-fallback-logica zelf staan in
 * lib/ai/supplierAssistantMock.ts (bewust GEEN "server-only", zodat die
 * logica automatisch getest kan worden via `npm test` — zie dat bestand).
 */
export type { SupplierAssistantContext };

export async function askSupplierAssistant(question: string, ctx: SupplierAssistantContext): Promise<{ answer: string; usedAI: boolean }> {
  const aiAnswer = await callFreeTextAI({
    role: "supplier_assistant",
    system: SUPPLIER_ASSISTANT_PROMPT,
    user: `Contextdata van de leverancier (JSON): ${serializeSupplierContext(ctx)}\n\nVraag van de leverancier: "${question}"`,
    context: { userId: ctx.supplier.ownerId },
  });
  if (aiAnswer) return { answer: aiAnswer, usedAI: true };
  return { answer: mockSupplierAssistantAnswer(question, ctx), usedAI: false };
}

/**
 * Conceptantwoord op een binnengekomen bericht van een organisator (Pro+).
 * `threadSummary` is de recente berichtgeschiedenis (kort, platte tekst) —
 * de aanroeper bouwt dit al op uit de bestaande Message[]-lijst, dezelfde
 * aanpak als de AI-samenvatting die daar al voor bestaat.
 */
export async function draftSupplierReply(params: {
  supplierId: string;
  ownerId: string;
  categoryLabel: string;
  eventName: string | null;
  threadSummary: string;
  latestMessage: string;
}): Promise<{ draft: string; usedAI: boolean }> {
  const aiAnswer = await callFreeTextAI({
    role: "supplier_reply_draft",
    system: SUPPLIER_REPLY_DRAFTER_PROMPT,
    user: `Categorie: ${params.categoryLabel}\nEvenement: ${params.eventName ?? "onbekend"}\nEerdere berichten (kort): ${params.threadSummary}\nMeest recente bericht van de organisator: "${params.latestMessage}"`,
    context: { userId: params.ownerId },
  });
  if (aiAnswer) return { draft: aiAnswer, usedAI: true };
  return { draft: mockSupplierReplyDraft(params.categoryLabel, params.eventName), usedAI: false };
}

/** Dagelijkse prioriteitenbriefing (Premium+) — narratieve samenvatting van vooraf berekende signalen, zie lib/data/store.ts voor de signaal-detectie zelf. */
export async function narrateSupplierBriefing(params: {
  ownerId: string;
  signals: string[];
}): Promise<{ narrative: string; usedAI: boolean }> {
  if (params.signals.length === 0) {
    return { narrative: mockSupplierBriefing(params.signals), usedAI: false };
  }
  const aiAnswer = await callFreeTextAI({
    role: "supplier_priority_briefing",
    system: SUPPLIER_PRIORITY_BRIEFING_PROMPT,
    user: `Signalen van vandaag:\n${params.signals.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
    context: { userId: params.ownerId },
  });
  if (aiAnswer) return { narrative: aiAnswer, usedAI: true };
  return { narrative: mockSupplierBriefing(params.signals), usedAI: false };
}

/** Profieltekst-hulp (Premium+) — schrijft de bedrijfsbeschrijving/tagline om. */
export async function rewriteSupplierProfileText(params: {
  ownerId: string;
  companyName: string;
  categoryLabels: string[];
  currentDescription: string;
  currentTagline: string | null;
}): Promise<{ description: string; usedAI: boolean }> {
  const aiAnswer = await callFreeTextAI({
    role: "supplier_profile_text",
    system: SUPPLIER_PROFILE_TEXT_PROMPT,
    user: `Bedrijfsnaam: ${params.companyName}\nCategorieën: ${params.categoryLabels.join(", ")}\nHuidige tagline: ${params.currentTagline ?? "(geen)"}\nHuidige beschrijving: "${params.currentDescription || "(nog geen beschrijving ingevuld)"}"`,
    context: { userId: params.ownerId },
  });
  if (aiAnswer) return { description: aiAnswer, usedAI: true };
  // Mock-fallback: geen AI-provider geconfigureerd — geef de bestaande tekst
  // ongewijzigd terug (nooit een verzonnen tekst tonen alsof het een echt
  // AI-voorstel is) met een duidelijke melding, zodat de knop nooit een
  // stille no-op lijkt.
  return {
    description: params.currentDescription || `${params.companyName} — ${params.categoryLabels.join(", ")}.`,
    usedAI: false,
  };
}
