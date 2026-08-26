import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhookSignature } from "@/lib/payments/stripe-webhook";
import { getPaymentByStripeCheckoutSessionId, markPaymentPaidByWebhook, upsertSupplierStripeAccountFromWebhook } from "@/lib/data/store";

/**
 * Stripe-webhook-ontvanger — voorbereiding voor een echte betaalflow
 * (spec-item #132). NOG NIET bereikbaar in productie: zonder
 * `STRIPE_WEBHOOK_SECRET` (zie .env.example) antwoordt deze route altijd
 * "niet geconfigureerd" en doet verder niets, exact hetzelfde
 * "graceful fallback zonder sleutels"-patroon als de andere routes in dit
 * project die van een externe dienst afhangen (bv.
 * app/api/cron/supplier-proactive-signals). Zodra Cem zelf een
 * Stripe-account aansluit, deze env-var zet ÉN de webhook-URL bij Stripe
 * registreert, gaat 'ie pas daadwerkelijk iets verwerken.
 *
 * Signature-verificatie gebeurt met de hand (lib/payments/stripe-webhook.ts)
 * i.p.v. via de `stripe`-npm-package — zie de toelichting daar voor waarom
 * dat hier verantwoord is.
 *
 * Twee events worden afgehandeld, precies de twee die het datamodel uit
 * migratie 0049 voorbereidt:
 *  - `checkout.session.completed` — de betaling op "paid" zetten via
 *    `markPaymentPaidByWebhook` (de service-role-tegenhanger van
 *    `markPaymentPaid`/`acceptOffer`/`updateRequirementStatus` in
 *    lib/data/store.ts, nodig omdat een inkomend webhook-request geen
 *    ingelogde gebruiker/sessie heeft).
 *  - `account.updated` — `charges_enabled`/`payouts_enabled` van een
 *    leverancier bijwerken in `supplier_stripe_accounts`.
 *
 * NOG GEEN checkout-sessie-aanmaak hier, en dus ook geen manier om deze
 * twee events ooit daadwerkelijk te laten binnenkomen: dat vereist de
 * `stripe`-package en een echte secret key om `stripe.checkout.sessions.create()`
 * aan te roepen. Dat hoort bij de daadwerkelijke aansluiting zelf, buiten
 * deze voorbereiding (zie de toelichting die Cem hierover heeft gekregen).
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ skipped: "STRIPE_WEBHOOK_SECRET niet geconfigureerd" });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!verifyStripeWebhookSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "Ongeldige signature" }, { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as { id: string; payment_intent: string | null };
      if (session.payment_intent) {
        const payment = await getPaymentByStripeCheckoutSessionId(session.id);
        if (payment) await markPaymentPaidByWebhook(payment.id, { stripePaymentIntentId: session.payment_intent });
      }
      break;
    }
    case "account.updated": {
      const account = event.data.object as { id: string; charges_enabled: boolean; payouts_enabled: boolean };
      await upsertSupplierStripeAccountFromWebhook(account.id, {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      });
      break;
    }
    default:
      // Andere eventtypes (bv. payment_intent.payment_failed) worden nog
      // niet afgehandeld — komt bij de daadwerkelijke aansluiting.
      break;
  }

  return NextResponse.json({ received: true });
}
