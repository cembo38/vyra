/**
 * Centrale platformconfiguratie.
 *
 * Belangrijk: bedrijfsregels zoals het commissiepercentage staan hier op
 * één plek. Nergens anders in de applicatie mag 0.095 hardcoded worden.
 * Dit maakt het later triviaal om het percentage te wijzigen, per
 * leverancierscategorie te differentiëren, of A/B te testen — zonder de
 * rest van de applicatie aan te raken.
 */

export const PLATFORM_COMMISSION_RATE = 0.095; // 9,5% platformcommissie

export const SUPPLIER_RESPONSE_WINDOW_HOURS = 48;

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
 * E-mailadres(sen) die toegang hebben tot /admin. Alleen deze gebruiker(s)
 * kunnen het platformbrede admin-dashboard zien — iedereen anders wordt
 * doorgestuurd. Zet hier je eigen e-mailadres; meerdere adressen kan met
 * een komma-gescheiden lijst in ADMIN_EMAILS (env var), als fallback wordt
 * onderstaand adres gebruikt.
 */
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "cemadiyaman91@gmail.com")
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

export function calculateCommission(supplierAmountInCents: number, rate: number = PLATFORM_COMMISSION_RATE) {
  const platformFee = Math.round(supplierAmountInCents * rate);
  const total = supplierAmountInCents + platformFee;
  return { supplierAmount: supplierAmountInCents, platformFee, total, rate };
}
