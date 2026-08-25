"use server";

import { getCurrentUser } from "@/lib/auth";
import { askSupplierAssistant, draftSupplierReply, rewriteSupplierProfileText } from "@/lib/ai/supplierAssistant";
import { writeSupplierOfferText } from "@/lib/ai/supplierOffer";
import {
  checkSupplierAssistantAccess,
  generateAndCacheSupplierBriefing,
  getMessages,
  getSupplierAccountByOwner,
  getSupplierEarningsSummary,
  getSupplierLeads,
  getSupplierOrders,
  getSupplierPerformanceInsights,
  logSupplierAssistantUsage,
} from "@/lib/data/store";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";

/**
 * Eén gedeelde helper voor elke server action hieronder: haalt de
 * leverancier van de ingelogde gebruiker op en controleert meteen de
 * VyrAI-toegang (abonnementsniveau + dagelijkse limiet, zie
 * checkSupplierAssistantAccess in lib/data/store.ts). Nooit een exception —
 * elke aanroeper krijgt een duidelijke, voor de UI bruikbare reden terug
 * i.p.v. een crash, precies zoals Cem vroeg: een betalende leverancier mag
 * nooit met een kapotte knop blijven zitten.
 */
async function requireSupplierAssistantAccess(requiredTier: 1 | 2 = 1) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, message: "Je bent niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return { ok: false as const, message: "Geen leveranciersaccount gevonden." };

  const access = await checkSupplierAssistantAccess(supplier.id, requiredTier);
  if (!access.allowed) {
    const message =
      access.reason === "geen_toegang"
        ? "VyrAI-assistent is beschikbaar vanaf abonnement Pro. Upgrade je abonnement om dit te gebruiken."
        : "Je hebt je dagelijkse VyrAI-limiet voor vandaag bereikt. Morgen kun je weer verder — bij Enterprise geldt geen limiet.";
    return { ok: false as const, message };
  }
  return { ok: true as const, supplier };
}

export async function askSupplierAssistantAction(question: string): Promise<{ answer: string; usedAI: boolean; blocked?: boolean }> {
  const access = await requireSupplierAssistantAccess(1);
  if (!access.ok) return { answer: access.message, usedAI: false, blocked: true };

  const [leads, orders, earnings, insights] = await Promise.all([
    getSupplierLeads(access.supplier.id),
    getSupplierOrders(access.supplier.id),
    getSupplierEarningsSummary(access.supplier.id),
    getSupplierPerformanceInsights(access.supplier.id),
  ]);

  const result = await askSupplierAssistant(question, { supplier: access.supplier, leads, orders, earnings, insights });
  await logSupplierAssistantUsage(access.supplier.id, "chat");
  return result;
}

/**
 * Conceptantwoord op een organisatorbericht binnen een aanvraag-thread
 * (Pro+). Haalt de threadgeschiedenis ZELF op (via `requestId`) i.p.v. dat
 * de client-component 'm al moet opbouwen — zo blijft MessageComposer.tsx
 * eenvoudig (alleen `requestId` als extra prop nodig) en staat alle
 * context-opbouw op één plek, net als bij askSupplierAssistantAction.
 *
 * Het conceptantwoord wordt NOOIT automatisch verstuurd — het vult alleen
 * het invoerveld, de leverancier verstuurt het zelf pas na controle/
 * aanpassing (Waarborg #1 uit het voorstel, zie het conceptdocument dat
 * naar Cem is gestuurd).
 */
export async function draftSupplierReplyAction(requestId: string): Promise<{ draft: string; usedAI: boolean; blocked?: boolean }> {
  const access = await requireSupplierAssistantAccess(1);
  if (!access.ok) return { draft: access.message, usedAI: false, blocked: true };

  const lead = (await getSupplierLeads(access.supplier.id)).find((l) => l.request.id === requestId);
  if (!lead) return { draft: "Kon deze aanvraag niet vinden.", usedAI: false, blocked: true };

  const categoryLabel = SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey];
  const messages = await getMessages(lead.event.id, lead.request.categoryKey, access.supplier.id);
  const conversational = messages.filter((m) => m.sender !== "ai_summary");
  const latest = [...conversational].reverse().find((m) => m.sender === "customer");

  if (!latest) {
    return { draft: "Er is nog geen bericht van de organisator om op te reageren.", usedAI: false, blocked: true };
  }

  // Laatste ~6 berichten als korte platte-tekst-samenvatting — genoeg
  // gespreksgeheugen voor een zinnig concept, zonder de hele historie (en
  // dus onnodig veel tokens) mee te sturen.
  const threadSummary = conversational
    .slice(-6)
    .map((m) => `${m.sender === "supplier" ? "Leverancier" : "Organisator"}: ${m.text}`)
    .join("\n");

  const result = await draftSupplierReply({
    supplierId: access.supplier.id,
    ownerId: access.supplier.ownerId,
    categoryLabel,
    eventName: lead.event.name,
    threadSummary,
    latestMessage: latest.text,
  });
  await logSupplierAssistantUsage(access.supplier.id, "reply_draft");
  return result;
}

/**
 * Offertehulp (Pro+): schrijft een korte, stenografische omschrijving uit
 * tot een volledige offertetekst — de leverancier ziet 'm meteen in het
 * beschrijvingsveld van SupplierOfferForm.tsx, waarna hij zoals gewoonlijk
 * eerst nog zelf kan controleren/aanpassen vóórdat hij 'm (via de bestaande
 * "Genereer offerte-voorstel"-stap) laat structureren en verstuurt.
 */
export async function writeSupplierOfferTextAction(shorthand: string): Promise<{ text: string; usedAI: boolean; blocked?: boolean }> {
  if (!shorthand.trim()) return { text: "", usedAI: false, blocked: true };
  const access = await requireSupplierAssistantAccess(1);
  if (!access.ok) return { text: access.message, usedAI: false, blocked: true };

  const result = await writeSupplierOfferText(shorthand, { userId: access.supplier.ownerId });
  await logSupplierAssistantUsage(access.supplier.id, "offer_helper");
  return result;
}

/**
 * Dagelijkse prioriteitenbriefing (Premium+): gecachet per kalenderdag (zie
 * generateAndCacheSupplierBriefing in lib/data/store.ts), dus telt maar
 * hooguit één keer per dag mee tegen de limiet — herhaalde paginaweergaves
 * op dezelfde dag hergebruiken de al gegenereerde tekst.
 */
export async function generateSupplierBriefingAction(): Promise<{ narrative: string; usedAI: boolean; blocked?: boolean }> {
  const access = await requireSupplierAssistantAccess(2);
  if (!access.ok) return { narrative: access.message, usedAI: false, blocked: true };

  const result = await generateAndCacheSupplierBriefing(access.supplier.id, access.supplier.ownerId);
  if (!result.cached) await logSupplierAssistantUsage(access.supplier.id, "briefing");
  return result;
}

/**
 * Profieltekst-hulp (Premium+): schrijft de bedrijfsbeschrijving om — de
 * leverancier ziet 'm meteen in het Beschrijving-veld op /supplier/profile
 * (SupplierDescriptionField.tsx) en moet nog wel zelf op "Wijzigingen
 * opslaan" klikken; er wordt hier niets automatisch bewaard.
 */
export async function rewriteSupplierProfileTextAction(params: {
  companyName: string;
  categoryLabels: string[];
  currentDescription: string;
  currentTagline: string | null;
}): Promise<{ description: string; usedAI: boolean; blocked?: boolean }> {
  const access = await requireSupplierAssistantAccess(2);
  if (!access.ok) return { description: access.message, usedAI: false, blocked: true };

  const result = await rewriteSupplierProfileText({ ownerId: access.supplier.ownerId, ...params });
  await logSupplierAssistantUsage(access.supplier.id, "profile_text");
  return result;
}
