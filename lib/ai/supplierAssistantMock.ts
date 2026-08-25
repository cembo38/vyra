/**
 * Pure, testbare logica voor de VyrAI-assistent (leverancierskant) — bewust
 * GEEN "server-only" (net als lib/ai/catalog.ts, zie de toelichting in
 * vitest.config.ts): dit bestand raakt geen geheimen en geen netwerk, dus
 * kan via `npm test` automatisch gedekt worden. lib/ai/supplierAssistant.ts
 * (dat wél "server-only" is, i.v.m. de echte AI-aanroep) importeert deze
 * functies voor zowel het opbouwen van de AI-context als de mock-fallback
 * die gebruikt wordt zolang er geen ANTHROPIC_API_KEY geconfigureerd is —
 * dat is in DEZE sandbox altijd het geval, dus dit is precies het codepad
 * dat hier het meest concreet te verifiëren is.
 */
import { formatCurrency } from "@/lib/config";
import {
  SupplierAccount,
  SupplierEarningsSummary,
  SupplierLead,
  SupplierOrder,
  SupplierPerformanceInsights,
  SUPPLIER_CATEGORY_LABELS,
} from "@/lib/types";

export interface SupplierAssistantContext {
  supplier: SupplierAccount;
  leads: SupplierLead[];
  orders: SupplierOrder[];
  earnings: SupplierEarningsSummary;
  insights: SupplierPerformanceInsights;
}

export function serializeSupplierContext(ctx: SupplierAssistantContext): string {
  const now = new Date();
  return JSON.stringify({
    bedrijf: {
      naam: ctx.supplier.companyName,
      categorieen: ctx.supplier.categories.map((c) => SUPPLIER_CATEGORY_LABELS[c]),
      werkgebied: `${ctx.supplier.baseLocation} (${ctx.supplier.serviceRadiusKm} km)`,
    },
    openAanvragen: ctx.leads
      .filter((l) => l.target.status === "pending")
      .map((l) => ({
        categorie: SUPPLIER_CATEGORY_LABELS[l.request.categoryKey],
        evenement: l.event.name,
        eventDatum: l.event.date,
        deadline: l.request.deadlineAt,
        budgetIndicatie: l.request.budgetCents != null ? formatCurrency(l.request.budgetCents) : null,
      })),
    aankomendeBoekingen: ctx.orders
      .filter((o) => o.event?.date && new Date(o.event.date) >= now)
      .map((o) => ({
        categorie: SUPPLIER_CATEGORY_LABELS[o.offer.categoryKey],
        evenement: o.event?.name,
        eventDatum: o.event?.date,
        bedrag: formatCurrency(o.offer.totalPriceCents),
        betaalstatus: o.payment?.status ?? "onbekend",
      })),
    verdiensten: {
      uitbetaald: formatCurrency(ctx.earnings.paidCents),
      inAfwachting: formatCurrency(ctx.earnings.pendingCents),
      actieveBoekingen: ctx.earnings.activeOrdersCount,
      dezeMaand: ctx.earnings.upcomingThisMonthCount,
    },
    prestaties: {
      reactiesnelheidUren: ctx.insights.avgResponseHours,
      categoriegemiddeldeReactiesnelheidUren: ctx.insights.categoryAvgResponseHours,
      beoordeling: ctx.insights.ratingAvg,
      aantalBeoordelingen: ctx.insights.ratingCount,
      categoriegemiddeldeBeoordeling: ctx.insights.categoryAvgRating,
    },
  });
}

export function mockSupplierAssistantAnswer(question: string, ctx: SupplierAssistantContext): string {
  const q = question.toLowerCase();
  const openLeads = ctx.leads.filter((l) => l.target.status === "pending");
  const now = new Date();
  const upcoming = ctx.orders.filter((o) => o.event?.date && new Date(o.event.date) >= now);

  if (/nog niet.*(gereageerd|gedaan)|open(staande)? aanvra|leads?\b|wachten.*op mij/.test(q)) {
    if (openLeads.length === 0) return "Je hebt op dit moment geen openstaande aanvragen — alles is beantwoord. Goed bezig!";
    const soonest = [...openLeads].sort((a, b) => new Date(a.request.deadlineAt).getTime() - new Date(b.request.deadlineAt).getTime())[0];
    return `Je hebt ${openLeads.length} openstaande aanvra${openLeads.length > 1 ? "gen" : "ag"}. De meest urgente is "${SUPPLIER_CATEGORY_LABELS[soonest.request.categoryKey]}" voor ${soonest.event.name}, met deadline ${new Date(soonest.request.deadlineAt).toLocaleDateString("nl-NL")}.`;
  }

  if (/verdien|omzet|inkomsten|betaald|uitbetaal/.test(q)) {
    return `Tot nu toe is er ${formatCurrency(ctx.earnings.paidCents)} aan je uitbetaald, met nog ${formatCurrency(ctx.earnings.pendingCents)} in afwachting over ${ctx.earnings.activeOrdersCount} actieve boeking${ctx.earnings.activeOrdersCount === 1 ? "" : "en"}.`;
  }

  if (/reactiesnelheid|reactietijd|hoe (snel|goed) (reageer|doe)|beoordeling|score|presteer/.test(q)) {
    const bits: string[] = [`Je gemiddelde reactietijd is ${ctx.insights.avgResponseHours.toFixed(1)} uur`];
    if (ctx.insights.categoryAvgResponseHours != null) {
      bits.push(ctx.insights.avgResponseHours <= ctx.insights.categoryAvgResponseHours ? "sneller dan het categoriegemiddelde" : "trager dan het categoriegemiddelde");
    }
    const ratingBit = ctx.insights.ratingCount > 0 ? `je beoordeling staat op ${ctx.insights.ratingAvg.toFixed(1)} (${ctx.insights.ratingCount} review${ctx.insights.ratingCount === 1 ? "" : "s"})` : "je hebt nog geen beoordelingen";
    return `${bits.join(", ")}. Daarnaast ${ratingBit}. Bekijk de Analyse-pagina voor het volledige overzicht.`;
  }

  if (/deze maand|aankomend|volgende boeking|planning/.test(q)) {
    if (upcoming.length === 0) return "Je hebt op dit moment geen aankomende boekingen gepland.";
    const next = [...upcoming].sort((a, b) => new Date(a.event!.date!).getTime() - new Date(b.event!.date!).getTime())[0];
    return `Je hebt ${upcoming.length} aankomende boeking${upcoming.length > 1 ? "en" : ""}. De eerstvolgende is "${SUPPLIER_CATEGORY_LABELS[next.offer.categoryKey]}" voor ${next.event!.name} op ${new Date(next.event!.date!).toLocaleDateString("nl-NL")}.`;
  }

  return "Ik heb je vraag genoteerd. Op basis van je huidige gegevens zie ik geen directe knelpunten — bekijk je dashboard voor het volledige overzicht van aanvragen, boekingen en verdiensten.";
}

/** Mock-fallback voor het conceptantwoord-op-bericht (Pro+), zie draftSupplierReply() in lib/ai/supplierAssistant.ts. */
export function mockSupplierReplyDraft(categoryLabel: string, eventName: string | null): string {
  return `Bedankt voor je bericht! Ik kijk er even naar en kom zo snel mogelijk bij je terug over "${categoryLabel}" voor ${eventName ?? "je evenement"}.`;
}

/** Mock-fallback voor de dagelijkse prioriteitenbriefing (Premium+), zie narrateSupplierBriefing() in lib/ai/supplierAssistant.ts. */
export function mockSupplierBriefing(signals: string[]): string {
  if (signals.length === 0) return "Geen urgente zaken vandaag — je aanvragen en gesprekken staan er goed voor. Fijne dag!";
  const rest = signals.length - 1;
  const restBit = rest > 0 ? ` (en nog ${rest} ander${rest === 1 ? "" : "e"} punt${rest === 1 ? "" : "en"}).` : ".";
  return `Vandaag verdient dit als eerst je aandacht: ${signals[0]}${restBit}`;
}

/**
 * Prijsadvies (Premium+, spec-item #57) — een pure, deterministische
 * vergelijking (geen AI-aanroep nodig: het is gewoon rekenwerk), zodat dit
 * altijd werkt, ook zonder ANTHROPIC_API_KEY en zonder tegen de dagelijkse
 * VyrAI-limiet te tellen. Drempel van 15% voorkomt dat een verwaarloosbaar
 * verschil (bv. 2%) als "advies" wordt gepresenteerd.
 */
export function buildSupplierPriceAdvice(avgPriceCents: number, categoryAvgPriceCents: number | null): string {
  if (categoryAvgPriceCents == null || categoryAvgPriceCents <= 0) {
    return "Nog niet genoeg vergelijkbare leveranciers met een ingevulde gemiddelde prijs in jouw categorie om een prijsvergelijking te maken.";
  }
  const diffPercent = Math.round(((avgPriceCents - categoryAvgPriceCents) / categoryAvgPriceCents) * 100);
  if (diffPercent >= 15) {
    return `Je gemiddelde prijs ligt ${diffPercent}% boven het categoriegemiddelde. Dat kan prima werken als je je onderscheidt (bijvoorbeeld met ervaring, kwaliteit of extra service) — check anders of je prijsstelling nog aansluit bij wat organisatoren in jouw categorie gewend zijn.`;
  }
  if (diffPercent <= -15) {
    return `Je gemiddelde prijs ligt ${Math.abs(diffPercent)}% onder het categoriegemiddelde. Je hebt hier mogelijk ruimte om je tarief te verhogen zonder minder aantrekkelijk te worden voor organisatoren.`;
  }
  return "Je gemiddelde prijs ligt dicht bij het categoriegemiddelde — een gangbare prijsstelling voor jouw categorie.";
}
