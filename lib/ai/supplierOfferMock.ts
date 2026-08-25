/**
 * Pure, testbare logica voor de leverancier-offerte-AI — bewust GEEN
 * "server-only" (zelfde reden/patroon als lib/ai/supplierAssistantMock.ts
 * en lib/ai/catalog.ts, zie vitest.config.ts): raakt geen geheimen/netwerk,
 * dus dekbaar via `npm test`. lib/ai/supplierOffer.ts (wél "server-only")
 * importeert deze functies als mock-fallback zolang er geen
 * ANTHROPIC_API_KEY geconfigureerd is.
 */
import { formatCurrency } from "@/lib/config";

export interface StructuredSupplierOffer {
  totalPriceCents: number | null;
  includes: string[];
  excludes: string[];
  staffIncluded: boolean;
  deliveryIncluded: boolean;
  setupIncluded: boolean;
  remarks: string | null;
}

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
export function pickOfferAmountCents(description: string): number | null {
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

export function mockParseOfferDescription(description: string): StructuredSupplierOffer {
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

/**
 * Mock-fallback voor de Offertehulp (Pro+, spec-item #57): zet een korte,
 * stenografische omschrijving ("catering 50p, incl bediening+levering,
 * 6500") om in een volledige, leesbare conceptzin — de OMGEKEERDE richting
 * van mockParseOfferDescription hierboven. Hergebruikt bewust dezelfde
 * pickOfferAmountCents()-heuristiek voor prijsherkenning, zodat beide
 * richtingen consistent hetzelfde bedrag herkennen uit dezelfde tekst.
 */
export function mockWriteOfferText(shorthand: string): string {
  const priceCents = pickOfferAmountCents(shorthand);
  const bits: string[] = [priceCents != null ? `Voor in totaal ${formatCurrency(priceCents)} verzorg ik dit graag` : "Ik verzorg dit graag voor je"];

  const inclusions: string[] = [];
  if (/personeel|bediening/i.test(shorthand)) inclusions.push("bediening/personeel");
  if (/lever|bezorg/i.test(shorthand)) inclusions.push("levering");
  if (/opbouw/i.test(shorthand)) inclusions.push("opbouw");
  if (/afbouw|ophalen/i.test(shorthand)) inclusions.push("afbouw");
  if (inclusions.length > 0) bits.push(`inclusief ${inclusions.join(", ")}`);
  if (/vega|vegetarisch|vegan/i.test(shorthand)) bits.push("met vegetarische/vegan opties");

  const mainSentence = `${bits.join(", ")}.`;
  return `${mainSentence} Laat gerust weten als je nog vragen hebt over wat er precies bij inbegrepen is.`;
}
