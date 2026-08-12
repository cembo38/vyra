"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAndSendRequest,
  createPaymentForOffer,
  decideSwipe,
  getEvent,
  getOffer,
  markPaymentPaid,
  pushNotification,
  updateRequirementStatus,
} from "@/lib/data/store";
import { SupplierCategory } from "@/lib/types";
import { getSupplierById } from "@/lib/data/suppliers";
import { formatCurrency } from "@/lib/config";

export async function sendRequestAction(params: {
  eventId: string;
  categoryKey: SupplierCategory;
  desiredService: string;
  specialRequests: string;
  budgetCents: number | null;
}) {
  const event = await getEvent(params.eventId);
  if (!event) return;

  const { request, offers } = await createAndSendRequest({
    eventId: params.eventId,
    categoryKey: params.categoryKey,
    desiredService: params.desiredService,
    specialRequests: params.specialRequests,
    budgetCents: params.budgetCents,
    locationLabel: event.locationLabel,
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
  const offer = await decideSwipe(offerId, decision);
  if (offer) {
    if (decision === "shortlisted") {
      await updateRequirementStatus(offer.eventId, offer.categoryKey, "shortlisted");
    }
    revalidatePath(`/events/${offer.eventId}`, "layout");
  }
  return offer;
}

export async function acceptOfferAction(offerId: string) {
  const offer = await getOffer(offerId);
  if (!offer) return;
  const payment = await createPaymentForOffer(offerId);
  if (!payment) return;
  revalidatePath(`/events/${offer.eventId}`, "layout");
  redirect(`/events/${offer.eventId}/checkout/${payment.id}`);
}

export async function confirmPaymentAction(paymentId: string) {
  const payment = await markPaymentPaid(paymentId);
  if (!payment) return;

  const offer = await getOffer(payment.offerId);
  const event = await getEvent(payment.eventId);
  await pushNotification({
    userId: event!.ownerId,
    eventId: payment.eventId,
    type: "payment_confirmed",
    title: "Betaling bevestigd",
    body: `Je betaling van ${formatCurrency(payment.totalCents)} is bevestigd${offer ? " voor " + (getSupplierById(offer.supplierId)?.companyName ?? "je leverancier") : ""}.`,
    href: `/events/${payment.eventId}/budget`,
  });

  revalidatePath(`/events/${payment.eventId}`, "layout");
  redirect(`/events/${payment.eventId}?paid=1`);
}
