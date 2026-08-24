"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getEvent, getOffer, getSupplierAccountByOwner, submitReview } from "@/lib/data/store";
import { ReviewerRole } from "@/lib/types";
import { clamp } from "@/lib/utils";

/**
 * Wederzijdse beoordeling na een geaccepteerde boeking (spec-item,
 * Airbnb-geïnspireerd) — organisator en leverancier kunnen elkaar allebei
 * beoordelen zodra de evenementdatum is geweest. Zelfde `{ ok, error }`-vorm
 * als de andere self-service acties (SpotlightPanel e.a.): client component
 * roept dit aan en werkt de UI direct bij, geen redirect.
 *
 * De rol (organizer/supplier) wordt hier bepaald, NIET door de client
 * meegegeven — anders zou iemand met devtools zich als de verkeerde kant
 * kunnen voordoen. `getOffer`/`getEvent` gaan via de al RLS-beschermde
 * tabellen, dus geven alleen data terug als deze gebruiker er überhaupt bij
 * mag (organisator van het evenement, of de leverancier zelf).
 */
export async function submitReviewAction(input: {
  offerId: string;
  rating: number;
  comment: string;
  noShow?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const offer = await getOffer(input.offerId);
  if (!offer || offer.status !== "accepted") return { ok: false, error: "Deze boeking is niet gevonden." };

  const event = await getEvent(offer.eventId);
  if (!event) return { ok: false, error: "Dit evenement is niet gevonden." };

  let reviewerRole: ReviewerRole;
  if (event.ownerId === user.id) {
    reviewerRole = "organizer";
  } else {
    const supplier = await getSupplierAccountByOwner(user.id);
    if (!supplier || supplier.id !== offer.supplierId) return { ok: false, error: "Je bent geen onderdeel van deze boeking." };
    reviewerRole = "supplier";
  }

  // Pas beoordelen zodra het evenement is geweest — vóór die tijd is er
  // nog niets om te beoordelen. Zelfde "< vandaag"-grens als de
  // aankomend/afgerond-indeling op de orders-pagina van een leverancier.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!event.date || new Date(event.date) >= today) {
    return { ok: false, error: "Je kunt pas beoordelen nadat de evenementdatum is geweest." };
  }

  const rating = clamp(Math.round(input.rating), 1, 5);
  const comment = input.comment.trim();

  const review = await submitReview({
    offerId: offer.id,
    eventId: event.id,
    supplierId: offer.supplierId,
    reviewerRole,
    rating,
    comment: comment.length > 0 ? comment : null,
    noShow: reviewerRole === "supplier" ? Boolean(input.noShow) : false,
  });
  if (!review) return { ok: false, error: "Opslaan is niet gelukt — mogelijk heb je deze boeking al beoordeeld." };

  revalidatePath(`/events/${event.id}/shortlist`);
  revalidatePath("/supplier/orders");
  revalidatePath(`/leveranciers/${offer.supplierId}`);
  return { ok: true };
}
