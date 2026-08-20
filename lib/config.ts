/**
 * Centrale platformconfiguratie.
 *
 * Belangrijk: bedrijfsregels zoals het commissiemodel staan hier op één
 * plek. Nergens anders in de applicatie mag een percentage hardcoded
 * worden. Dit maakt het later triviaal om tarieven te wijzigen, per
 * leverancierscategorie te differentiëren, of A/B te testen — zonder de
 * rest van de applicatie aan te raken.
 */

/**
 * Commissiemodel (spec-item #53) — bewust NIET meer één vlak percentage.
 * Doel: eerst leveranciers/traffic laten groeien vóórdat er commissie wordt
 * verzilverd, en daarna een tarief dat grote boekingen niet onevenredig
 * hard raakt. Drie lagen, in volgorde van toepassing (zie
 * `resolveSupplierCommissionTier` in lib/data/store.ts):
 *
 * 1. "intro"  — een leverancier zijn eerste `INTRO_BOOKING_COUNT` succesvolle
 *    boekingen tellen tegen een laag, vast instaptarief. Dit is per
 *    leverancier (niet platformbreed), dus het schaalt vanzelf mee met elke
 *    nieuwe aanmelding — geen handmatig "omschakelmoment" nodig.
 * 2. "tiered" — ná de instapperiode: een gestaffeld tarief afhankelijk van
 *    het boekingsbedrag (net als belastingschijven — elk deel van het
 *    bedrag valt in zijn eigen schijf), met een maximum bedrag per boeking
 *    zodat een grote boeking nooit een onevenredig hoge fee oplevert.
 * 3. "pro"    — een leverancier die het Vyra Pro-abonnement heeft
 *    geactiveerd betaalt in plaats daarvan een vast maandbedrag en geen
 *    commissie per boeking meer (0%).
 */

/** Aantal succesvolle boekingen waarvoor een NIEUWE leverancier het lage instaptarief krijgt. */
export const INTRO_BOOKING_COUNT = 5;
export const INTRO_COMMISSION_RATE = 0.03; // 3%

/**
 * Gestaffelde tarieven ná de instapperiode. `uptoCents: null` betekent "en
 * hoger" — de laatste, open schijf. Elke schijf geldt alleen over het deel
 * van het bedrag dát in die schijf valt (progressief, zoals belastingschijven).
 */
export const COMMISSION_TIERS: { uptoCents: number | null; rate: number }[] = [
  { uptoCents: 50_000, rate: 0.06 }, // €0 – €500: 6%
  { uptoCents: 200_000, rate: 0.045 }, // €500 – €2.000: 4,5%
  { uptoCents: 1_000_000, rate: 0.03 }, // €2.000 – €10.000: 3%
  { uptoCents: null, rate: 0.02 }, // > €10.000: 2%
];

/** Maximumbedrag aan platformkosten per boeking, ongeacht het gestaffelde tarief hierboven. */
export const COMMISSION_FEE_CAP_CENTS = 40_000; // €400

/** Vyra Pro: vast maandbedrag i.p.v. commissie per boeking (indicatief — nog geen automatische incasso, zie lib/actions/supplier-actions.ts). */
export const PRO_SUBSCRIPTION_PRICE_CENTS = 7_900; // €79/maand
export const PRO_COMMISSION_RATE = 0;

export type CommissionTier = "intro" | "tiered" | "pro";

export const COMMISSION_TIER_LABELS: Record<CommissionTier, string> = {
  intro: "Instaptarief",
  tiered: "Gestaffeld tarief",
  pro: "Vyra Pro",
};

export const SUPPLIER_RESPONSE_WINDOW_HOURS = 48;

/**
 * Aantal dagen zonder wijziging aan een evenement (nog niet "confirmed",
 * "completed" of "cancelled") voordat het AI-team dit als "lijkt
 * stilgevallen" signaleert in het dagrapport (zie
 * generateAndStoreDailyBriefing() in lib/data/store.ts). Puur
 * informatief — geen automatische actie, alleen een seintje dat Cem
 * eventueel zelf even kan navragen bij de organisator.
 */
export const ORGANIZER_STALLED_DAYS = 7;

/**
 * Standaardpercentage voor een aanbetaling wanneer een organisator kiest om
 * een offerte in delen te betalen (aanbetaling nu, restbedrag later) in
 * plaats van in één keer. Zie createPaymentForOffer() in lib/data/store.ts.
 */
export const DEFAULT_DEPOSIT_PERCENT = 0.3; // 30% aanbetaling, 70% restbedrag

export const DEFAULT_CURRENCY = "EUR";
export const DEFAULT_LOCALE = "nl-NL";
export const DEFAULT_COUNTRY = "NL";

/** Aantal leveranciers dat standaard per aanvraag wordt benaderd (anti-spam). */
export const SUPPLIERS_PER_REQUEST = { min: 3, max: 5 };

/**
 * Of er een echte AI-provider is geconfigureerd. Als dit false is, valt de
 * hele AI-laag terug op deterministische mock-logica zodat de app zonder
 * API-key volledig te demonstreren blijft. Zie lib/ai/client.ts.
 *
 * Vyra gebruikt Claude (Anthropic) als AI-provider — zet ANTHROPIC_API_KEY
 * in .env.local (zie .env.example) om echte AI-aanroepen te activeren.
 */
export const AI_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY);

export const PAYMENTS_ENABLED = Boolean(process.env.STRIPE_SECRET_KEY);

/**
 * Of er e-mailmeldingen worden verstuurd (nieuwe aanvraag, nieuwe offerte,
 * verlopen reactietermijn) naast de bestaande in-app-meldingen. Zonder
 * RESEND_API_KEY blijft de app volledig werken, alleen dan zonder e-mail —
 * zelfde "graceful fallback"-patroon als AI_ENABLED/PAYMENTS_ENABLED. Zie
 * lib/email/send.ts.
 */
export const EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY);

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "Vyra <onboarding@resend.dev>";

/** Volledige site-URL, voor absolute links in e-mails (relatieve links werken niet in een mailclient). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vyra.now";

/**
 * E-mailadres(sen) die toegang hebben tot /admin. Alleen deze gebruiker(s)
 * kunnen het platformbrede admin-dashboard zien — iedereen anders wordt
 * doorgestuurd. Zet hier je eigen e-mailadres; meerdere adressen kan met
 * een komma-gescheiden lijst in ADMIN_EMAILS (env var), als fallback wordt
 * onderstaand adres gebruikt.
 *
 * Bugfix (spec-item #52): de fallback stond nog op cemadiyaman91@gmail.com,
 * maar Cems echte Vyra-account (waarmee hij live inlogt) gebruikt
 * cemadiyaman@hotmail.nl — daardoor werd hij op /admin altijd stilzwijgend
 * teruggestuurd naar /events, zonder foutmelding, alsof de pagina niet
 * bestond. Beide adressen staan nu in de fallback zodat dit niet nogmaals
 * per ongeluk kan gebeuren als er ooit met een ander account wordt
 * ingelogd.
 */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "cemadiyaman@hotmail.nl,cemadiyaman91@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function formatCurrency(
  amountInCents: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountInCents / 100);
}

/**
 * Berekent de platformkosten voor een boeking, volgens het lagenmodel
 * hierboven. `tier` bepaalt welke laag van toepassing is voor déze
 * leverancier op dít moment — zie `resolveSupplierCommissionTier` in
 * lib/data/store.ts, dat per leverancier bepaalt of hij nog in zijn
 * instapperiode zit, het gestaffelde tarief betaalt, of Pro-abonnee is.
 *
 * `rate` in het resultaat is het EFFECTIEVE (gemiddelde) percentage over
 * het hele bedrag — bij "tiered" dus niet gelijk aan één van de
 * schijfpercentages, maar de blend ervan (handig voor weergave, bv.
 * "Platformkosten (4,1%)" op de afrekenpagina).
 */
export function calculateCommission(supplierAmountInCents: number, tier: CommissionTier = "tiered") {
  if (tier === "pro") {
    return { supplierAmount: supplierAmountInCents, platformFee: 0, total: supplierAmountInCents, rate: PRO_COMMISSION_RATE, tier };
  }

  if (tier === "intro") {
    const platformFee = Math.round(supplierAmountInCents * INTRO_COMMISSION_RATE);
    return { supplierAmount: supplierAmountInCents, platformFee, total: supplierAmountInCents + platformFee, rate: INTRO_COMMISSION_RATE, tier };
  }

  // "tiered" — elk deel van het bedrag valt in zijn eigen schijf (progressief).
  let remaining = supplierAmountInCents;
  let lowerBoundCents = 0;
  let feeCents = 0;
  for (const bracket of COMMISSION_TIERS) {
    const upperBoundCents = bracket.uptoCents ?? Infinity;
    const amountInBracket = Math.max(0, Math.min(remaining, upperBoundCents - lowerBoundCents));
    feeCents += amountInBracket * bracket.rate;
    remaining -= amountInBracket;
    lowerBoundCents = upperBoundCents;
    if (remaining <= 0) break;
  }
  const platformFee = Math.min(Math.round(feeCents), COMMISSION_FEE_CAP_CENTS);
  const rate = supplierAmountInCents > 0 ? platformFee / supplierAmountInCents : 0;
  return { supplierAmount: supplierAmountInCents, platformFee, total: supplierAmountInCents + platformFee, rate, tier };
}
