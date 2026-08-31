import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/payments/stripe";
import { SUBSCRIPTION_TIER_ORDER, SubscriptionTier } from "@/lib/config";
import {
  applySupplierSubscriptionFromWebhook,
  getPaymentByStripeCheckoutSessionId,
  markPaymentPaidByWebhook,
  resetSupplierToFreeTierFromWebhook,
  setSupplierSubscriptionStatusFromWebhook,
  upsertSupplierStripeAccountFromWebhook,
} from "@/lib/data/store";

/**
 * Stripe-webhook-ontvanger. Sinds aug. 2026 verwerkt dit ECHTE
 * leveranciers-abonnementen (spec-item #53-vervolg) via de officiële
 * `stripe`-package — voorheen (voorbereiding, spec-item #132) werd de
 * signature met de hand geverifieerd (lib/payments/stripe-webhook.ts, nu
 * ongebruikt/verwijderd) omdat er nog geen echte Stripe-koppeling was.
 * `stripe.webhooks.constructEvent()` doet nu zowel de verificatie als het
 * parsen in één stap, betrouwbaarder dan de eigen implementatie.
 *
 * Zonder `STRIPE_SECRET_KEY` én `STRIPE_WEBHOOK_SECRET` (zie .env.example)
 * antwoordt deze route altijd "niet geconfigureerd" en doet verder niets —
 * zelfde "graceful fallback zonder sleutels"-patroon als overal elders in
 * dit project. Zodra Cem zelf de Stripe-sleutels zet ÉN de webhook-URL bij
 * Stripe registreert, gaat 'ie pas daadwerkelijk iets verwerken.
 *
 * Twee soorten geld gaan hierover, uit elkaar gehouden via `session.mode`:
 *  - `subscription` — een leverancier die een betaald abonnement afsluit of
 *    wisselt (zie changeSubscriptionTierAction in
 *    lib/actions/supplier-actions.ts). NIEUW in deze aug.-2026-koppeling.
 *  - `payment` — de organisator-betaalt-leverancier-marktplaatsflow
 *    (voorbereid in migratie 0049); er bestaat nog GEEN checkout-sessie-
 *    aanmaak-code hiervoor (dat is Deel B3, nog te bouwen), maar de
 *    afhandeling hier staat al klaar voor zodra die er is.
 *
 * `account.updated` (Stripe Connect, voor leveranciers-uitbetalingen, ook
 * B3) en `customer.subscription.updated`/`deleted`/`invoice.payment_failed`
 * (abonnementsstatus bijhouden) worden ook afgehandeld.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ skipped: "Stripe niet volledig geconfigureerd" });
  }

  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Ontbrekende signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[webhooks/stripe] signature-verificatie mislukt:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Ongeldige signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription" && session.subscription && session.customer) {
        const meta = session.metadata ?? {};
        const tier = meta.tier as SubscriptionTier | undefined;
        const billingInterval = meta.billingInterval as "monthly" | "annual" | undefined;
        if (tier && SUBSCRIPTION_TIER_ORDER.includes(tier) && (billingInterval === "monthly" || billingInterval === "annual")) {
          const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer.id;
          await applySupplierSubscriptionFromWebhook({
            supplierId: meta.supplierId || undefined,
            stripeCustomerId,
            stripeSubscriptionId,
            tier,
            billingInterval,
            // Het daadwerkelijk afgeschreven bedrag van DEZE sessie — niet
            // teruggezocht in lib/config.ts, want de leverancier moet het
            // bedrag blijven zien/betalen waar hij op dit moment voor
            // tekende, ook als de lijstprijs later wijzigt (zie migratie 50).
            priceCents: session.amount_total ?? 0,
            status: "active",
          });

          // Wisselde de leverancier van een al lopend abonnement naar dit
          // nieuwe (zie changeSubscriptionTierAction) — annuleer het oude nu
          // de nieuwe checkout daadwerkelijk is afgerond. Pas HIER doen,
          // nooit vóór de nieuwe checkout is bevestigd, anders staat een
          // leverancier tijdelijk zonder enig abonnement als hij de nieuwe
          // checkout niet afmaakt.
          const previousSubscriptionId = meta.previousStripeSubscriptionId;
          if (previousSubscriptionId && previousSubscriptionId !== stripeSubscriptionId) {
            try {
              await stripe.subscriptions.cancel(previousSubscriptionId);
            } catch (err) {
              // Alwas al opgezegd, of bestaat niet meer — geen probleem, de
              // nieuwe subscriptie is en blijft leidend.
              console.error("[webhooks/stripe] annuleren vorig abonnement mislukt:", err instanceof Error ? err.message : err);
            }
          }
        }
      } else if (session.mode === "payment" && session.payment_intent) {
        // Marktplaats-betaalflow (Deel B3, nog te bouwen) — bestaande
        // voorbereiding, ongewijzigd.
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
        const payment = await getPaymentByStripeCheckoutSessionId(session.id);
        if (payment) await markPaymentPaidByWebhook(payment.id, { stripePaymentIntentId: paymentIntentId });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const meta = subscription.metadata ?? {};
      const tier = meta.tier as SubscriptionTier | undefined;
      const billingInterval = meta.billingInterval as "monthly" | "annual" | undefined;
      const status = mapStripeSubscriptionStatus(subscription.status);

      if (tier && SUBSCRIPTION_TIER_ORDER.includes(tier) && (billingInterval === "monthly" || billingInterval === "annual")) {
        const item = subscription.items.data[0];
        await applySupplierSubscriptionFromWebhook({
          supplierId: meta.supplierId || undefined,
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          tier,
          billingInterval,
          priceCents: item?.price?.unit_amount ?? 0,
          status,
        });
      } else {
        // Geen (bij ons bekende) metadata op deze subscription — bv. een
        // wijziging die niet via changeSubscriptionTierAction liep. Het
        // niveau kennen we dan niet automatisch, maar de status in elk
        // geval wel bijwerken (bv. een geslaagde herpoging na past_due).
        await setSupplierSubscriptionStatusFromWebhook(subscription.id, status);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await resetSupplierToFreeTierFromWebhook(subscription.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      if (subscriptionId) await setSupplierSubscriptionStatusFromWebhook(subscriptionId, "past_due");
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await upsertSupplierStripeAccountFromWebhook(account.id, {
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
      });
      break;
    }

    default:
      // Andere eventtypes worden nog niet afgehandeld.
      break;
  }

  return NextResponse.json({ received: true });
}

/** Stripe's subscription-statussen naar ons eigen, kleinere `SupplierAccount.subscriptionStatus`-domein. */
function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "incomplete" {
  switch (status) {
    case "active":
    case "trialing": // Vyra gebruikt geen Stripe-trials zelf (de proefperiode loopt los, zie TRIAL_TIER_DEFINITION), maar behandel 'm defensief toch als actief.
      return "active";
    case "past_due":
    case "unpaid":
    case "paused":
      return "past_due";
    case "canceled":
      return "canceled";
    default:
      return "incomplete";
  }
}
