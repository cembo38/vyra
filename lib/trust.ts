import { SupplierAccount } from "@/lib/types";

/**
 * "Samengevoegd vertrouwens-badge voor leveranciers" (livegang-audit) —
 * vóór dit bestand moest een organisator zelf vier losse signalen bij
 * elkaar optellen (geverifieerd? goede beoordeling? snel antwoord? offertes
 * die ook echt geaccepteerd worden?) om in te schatten hoe betrouwbaar een
 * leverancier is. Deze ene boolean combineert ze tot één duidelijk
 * "Vertrouwde leverancier"-predicaat (vergelijkbaar met Etsy's
 * "Star Seller") — gebruikt op zowel de zoekresultatenlijst
 * (app/leveranciers/page.tsx) als het publieke profiel
 * (app/leveranciers/[id]/page.tsx), zodat dezelfde criteria overal
 * hetzelfde betekenen.
 *
 * Bewust een STRIKTE bovengrens op "Geverifieerd" (dat betekent alleen dat
 * het KVK-nummer is gecontroleerd door Cem) — een leverancier die wel
 * geverifieerd is maar nog te weinig reviews/track record heeft, blijft
 * gewoon "Geverifieerd" zien i.p.v. een trust-signaal te krijgen dat de
 * onderliggende cijfers nog niet waarmaken.
 */
const MIN_RATING_COUNT = 3;
const MIN_RATING_AVG = 4.5;
const MAX_RESPONSE_HOURS = 24;
const MIN_ACCEPTED_OFFER_RATE = 0.5;

/**
 * Zelfde ondergrens als de acceptatiegraad-weergave op het publieke profiel
 * — zonder deze grens zou een leverancier die net is begonnen en zijn
 * eerste offerte toevallig ziet afgewezen een keihard "0% geaccepteerd"
 * tegen zich zien werken. Hier verhuisd vanuit app/leveranciers/[id]/
 * page.tsx zodat beide plekken (lijst + profiel) 'm delen.
 */
export const MIN_OFFERS_FOR_ACCEPTANCE_RATE = 3;

type TrustSignals = Pick<SupplierAccount, "verified" | "ratingAvg" | "ratingCount" | "avgResponseHours" | "acceptedOfferRate" | "offersSubmittedCount">;

export function isTrustedSupplier(supplier: TrustSignals): boolean {
  if (!supplier.verified) return false;
  if (supplier.ratingCount < MIN_RATING_COUNT || supplier.ratingAvg < MIN_RATING_AVG) return false;
  if (supplier.avgResponseHours > MAX_RESPONSE_HOURS) return false;
  if (supplier.offersSubmittedCount >= MIN_OFFERS_FOR_ACCEPTANCE_RATE && supplier.acceptedOfferRate < MIN_ACCEPTED_OFFER_RATE) return false;
  return true;
}

export const TRUST_BADGE_EXPLANATION = `Geverifieerd, minimaal ${MIN_RATING_AVG.toFixed(1)}★ (${MIN_RATING_COUNT}+ reviews), reageert doorgaans binnen ${MAX_RESPONSE_HOURS} uur en accepteert de meeste aanvragen.`;
