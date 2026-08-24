"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  createAndSendRequest,
  createPaymentForOffer,
  decideSwipe,
  getEvent,
  getOffer,
  getPayment,
  markPaymentPaid,
  pushNotification,
  resolveSupplierDisplay,
  updateEvent,
  updateRequirementStatus,
} from "@/lib/data/store";
import { SupplierCategory } from "@/lib/types";
import { formatCurrency } from "@/lib/config";

/**
 * Geen van de acties in dit bestand controleerde eerder wie er ingelogd was
 * of dat diegene de eigenaar van het betrokken evenement is — ze werkten
 * puur op de meegegeven id's. RLS in Supabase beperkt de meeste losse
 * lees/schrijf-acties al tot rijen van de ingelogde gebruiker zelf, maar
 * `banned_at` wordt NERGENS in RLS gecontroleerd (alleen in `getCurrentUser()`
 * hieronder) — zonder deze check kon een geblokkeerd account, zolang de
 * sessie nog geldig was, gewoon door blijven boeken en betalen. Deze checks
 * lossen dat op én sluiten aan bij het patroon dat de rest van de app
 * (lib/actions/event-actions.ts, guest-actions.ts, ...) al overal gebruikt.
 */
export async function sendRequestAction(params: {
  eventId: string;
  categoryKey: SupplierCategory;
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(params.eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  // Voorheen zette alleen confirmRequirementsAction (de verzamelknop
  // onderaan de planpagina) de stage naar "sourcing" — nu je een aanvraag
  // ook rechtstreeks per categorie kunt versturen (zie
  // RequirementDraftEditor.tsx), moet DIT de plek zijn die de stage
  // bijwerkt, want dit is waar een aanvraag daadwerkelijk de deur uitgaat.
  // Werkt ook `updated_at` bij, wat belangrijk is voor het
  // "organizer_stalled"-signaal in het AI-team-dagrapport
  // (generateAndStoreDailyBriefing() in lib/data/store.ts) — dat leest
  // alleen `updated_at`, niet losse requirement-statussen, om te bepalen of
  // een organisator al een tijdje niets meer heeft gedaan.
  if (event.stage === "draft" || event.stage === "planning") {
    await updateEvent(params.eventId, { stage: "sourcing" });
  }

  const { request, offers } = await createAndSendRequest({
    eventId: params.eventId,
    categoryKey: params.categoryKey,
    desiredService: params.desiredService,
    specialRequests: params.specialRequests,
    budgetCents: params.budgetCents,
    locationLabel: event.locationLabel,
    eventDate: event.date,
  });

  await updateRequirementStatus(params.eventId, params.categoryKey, offers.length > 0 ? "offers_received" : "awaiting_response");

  if (offers.length > 0) {
    await pushNotification({
      userId: event.ownerId,
      eventId: event.id,
      type: "new_offer",
      title: `${offers.length} nieuwe offerte${offers.length > 1 ? "s" : ""}`,
      body: `Je hebt reacties ontvangen op je aanvraag voor ${params.categoryKey}.`,
      href: `/events/${event.id}/offers/${params.categoryKey}`,
    });
  }

  revalidatePath(`/events/${params.eventId}`, "layout");
  return { requestId: request.id, offerCount: offers.length };
}

export async function swipeOfferAction(offerId: string, decision: "shortlisted" | "rejected" | "none") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const existingOffer = await getOffer(offerId);
  if (!existingOffer) return null;
  const event = await getEvent(existingOffer.eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  const offer = await decideSwipe(offerId, decision);
  if (offer) {
    if (decision === "shortlisted") {
      await updateRequirementStatus(offer.eventId, offer.categoryKey, "shortlisted");
    }
    revalidatePath(`/events/${offer.eventId}`, "layout");
  }
  return offer;
}

export async function acceptOfferAction(offerId: string, plan: "full" | "deposit" = "full") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const offer = await getOffer(offerId);
  if (!offer) return;
  const event = await getEvent(offer.eventId);
  if (!event || event.ownerId !== user.id) redirect("/events");

  const payment = await createPaymentForOffer(offerId, plan);
  if (!payment) return;
  revalidatePath(`/events/${offer.eventId}`, "layout");
  redirect(`/events/${offer.eventId}/checkout/${payment.id}`);
}

/**
 * BELANGRIJK: dit verwerkt GEEN echte betaling. Er zit (nog) geen Stripe of
 * andere betaaldienst achter — `markPaymentPaid()` zet alleen de status in
 * onze eigen database op "betaald". De checkout-pagina zei hiervoor ten
 * onrechte "Veilig betalen via Stripe", terwijl er nooit een creditcard/
 * iDEAL-betaling werd verwerkt, met of zonder STRIPE_SECRET_KEY. Zolang er
 * geen echte betaaldienst is aangesloten, betaalt de organisator de
 * leverancier rechtstreeks (zie de toelichting op de checkout-pagina zelf)
 * — dit bevestigt alleen dát die boeking rondkomt, niet een transactie.
 * Zodra er wél een betaaldienst wordt aangesloten, hoort hier de
 * daadwerkelijke betaalbevestiging (bv. een Stripe-webhook) te komen i.p.v.
 * deze rechtstreekse marking-as-paid door de gebruiker zelf.
 */
export async function confirmPaymentAction(paymentId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const existingPayment = await getPayment(paymentId);
  if (!existingPayment) return;
  const ownerEvent = await getEvent(existingPayment.eventId);
  if (!ownerEvent || ownerEvent.ownerId !== user.id) redirect("/events");

  const payment = await markPaymentPaid(paymentId);
  if (!payment) return;

  const offer = await getOffer(payment.offerId);
  const event = await getEvent(payment.eventId);
  const supplier = offer ? await resolveSupplierDisplay(offer.supplierId) : null;
  // De boeking is al bevestigd door markPaymentPaid() hierboven — als het
  // event onverwacht niet (meer) op te halen is, mag dat de actie niet
  // laten crashen (de gebruiker zou anders een foutmelding zien terwijl de
  // boeking al wél is bevestigd). We slaan dan alleen de notificatie over
  // en gaan gewoon door naar het scherm van het evenement.
  if (event) {
    const label =
      payment.installment === "deposit" ? "Aanbetaling bevestigd" : payment.installment === "balance" ? "Restbedrag bevestigd" : "Betaling bevestigd";
    await pushNotification({
      userId: event.ownerId,
      eventId: payment.eventId,
      type: "payment_confirmed",
      title: label,
      body: `Je ${payment.installment === "deposit" ? "aanbetaling" : payment.installment === "balance" ? "restbedrag" : "betaling"} van ${formatCurrency(payment.totalCents)} is bevestigd${supplier ? " voor " + supplier.companyName : ""}.`,
      href: `/events/${payment.eventId}/budget`,
    });
  }

  revalidatePath(`/events/${payment.eventId}`, "layout");
  redirect(`/events/${payment.eventId}?paid=1`);
}

/**
 * NOODREPARATIE (zie build-fout op Vercel, commits a7c3c81 t/m 90c2d19):
 * `components/app/CounterOfferResponse.tsx` importeerde deze functie al,
 * maar ze bestond nergens — een eerdere, nooit afgemaakte poging tot een
 * "tegenbod"-functie (organisator stuurt een tegenbod, leverancier
 * accepteert/wijst af). Er bestaat nog GEEN datamodel voor tegenboden
 * (geen counterPriceCents/counterNote op OfferOption, geen manier voor een
 * organisator om er één te versturen) en `CounterOfferResponse` wordt op
 * dit moment nergens in de app getoond — dus dit brak alleen de build,
 * geen enkele echte gebruiker zag ooit deze knop.
 *
 * Dit is bewust alleen een MINIMALE, veilige stub die de site weer laat
 * bouwen — ze doet nog niets. Zie het rapport aan Cem voor de vraag of de
 * tegenbod-feature nu alsnog afgemaakt moet worden (was destijds bewust
 * overgeslagen, "minus counter-offer").
 */
export async function respondToCounterOfferAction(offerId: string, accept: boolean) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  void offerId;
  void accept;
}
