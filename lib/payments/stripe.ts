import Stripe from "stripe";

/**
 * Eén gedeelde Stripe-client voor de hele app (spec-item #53-vervolg —
 * echte Stripe-facturering voor leveranciers-abonnementen, aug. 2026).
 *
 * `getStripeClient()` geeft `null` terug zolang `STRIPE_SECRET_KEY` niet
 * gezet is — zelfde "graceful fallback zonder sleutels"-patroon als
 * AI_ENABLED/EMAIL_ENABLED/PUSH_ENABLED in lib/config.ts. Elke aanroeper
 * MOET dit controleren en netjes terugvallen (self-service Instap blijft
 * altijd werken; een betaald niveau valt terug op de handmatige
 * aanvraag-flow, zie changeSubscriptionTierAction in
 * lib/actions/supplier-actions.ts) — nooit een kale crash tonen aan een
 * leverancier omdat Cem de sleutels nog niet heeft ingevuld.
 *
 * Bewust een module-level singleton (i.p.v. steeds een nieuwe `Stripe`-
 * instantie aanmaken): de Stripe SDK zet zelf al connection-pooling/keep-
 * alive op, dat gaat verloren als je 'm bij elke request opnieuw aanmaakt.
 * Eén instantie per proces is het gebruikelijke patroon (zie Stripe's eigen
 * Next.js-voorbeelden).
 *
 * GEEN `apiVersion` expliciet meegegeven: de package (v22) pint zelf al een
 * vaste API-versie waar de meegeleverde TypeScript-types bij horen — dat
 * met de hand overschrijven zou de types en het gedrag uit sync kunnen
 * laten lopen zodra de package ooit wordt bijgewerkt.
 */
let cachedClient: Stripe | null | undefined;

export function getStripeClient(): Stripe | null {
  if (cachedClient !== undefined) return cachedClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  cachedClient = secretKey ? new Stripe(secretKey) : null;
  return cachedClient;
}
