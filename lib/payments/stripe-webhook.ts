import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verifieert een inkomende Stripe-webhook-signature — voorbereiding voor een
 * echte betaalflow (spec-item #132), zie app/api/webhooks/stripe/route.ts.
 *
 * Met de hand geïmplementeerd, ZONDER de `stripe`-npm-package: dat pakket
 * is nog niet geïnstalleerd (deze route is voorbereiding, geen live
 * integratie — er is nog geen echt Stripe-account), maar Stripe's
 * signing-schema zelf is een vast, publiek gedocumenteerd HMAC-protocol
 * (https://docs.stripe.com/webhooks#verify-manually), geen bewegend
 * doelwit dat SDK-onderhoud vraagt. Zelfde afweging als lib/ical.ts (RFC
 * 5545 met de hand i.p.v. een package): een stabiele, goed gedocumenteerde
 * spec is prima met de hand te implementeren en blijft zo ook zonder de
 * package testbaar.
 *
 * De `Stripe-Signature`-header ziet er zo uit: `t=<unix-timestamp>,v1=<hex-hmac>`
 * (soms met een extra `v0=`/`v1=`-paar bij een sleutelrotatie — dit project
 * heeft er maar één, dus alleen `v1` wordt gelezen). De verwachte
 * signature is HMAC-SHA256 van `${timestamp}.${ruwe request-body}`, met de
 * webhook-signing-secret (`STRIPE_WEBHOOK_SECRET`) als sleutel. Een
 * `tolerance`-venster (standaard 5 minuten, zoals Stripe's eigen SDK ook
 * hanteert) beschermt tegen replay van een oude, ooit-geldige request.
 */
export function verifyStripeWebhookSignature(payload: string, signatureHeader: string | null | undefined, secret: string, toleranceSeconds = 300): boolean {
  if (!signatureHeader || !secret) return false;

  const parts: Record<string, string> = {};
  for (const segment of signatureHeader.split(",")) {
    const [key, value] = segment.split("=");
    if (key && value) parts[key] = value;
  }
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > toleranceSeconds) return false;

  const expectedSignature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

  // `timingSafeEqual` vereist gelijke lengte buffers — bij een ongelijke
  // lengte is het sowieso geen match, en direct `false` teruggeven lekt
  // geen timing-informatie (er wordt dan nooit de langzamere
  // constant-time-vergelijking bereikt, maar de lengte van een hex-SHA256
  // is sowieso altijd 64 en dus voorspelbaar, geen geheim op zich).
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
