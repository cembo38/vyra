"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getEvent, getOffer, getSupplierAccountByOwner, submitReview, uploadSupplierFile } from "@/lib/data/store";
import { ReviewerRole } from "@/lib/types";
import { clamp, getVideoEmbedUrl } from "@/lib/utils";

// "Foto/video bij beoordelingen" (livegang-audit) — zelfde ondergrenzen als
// message-actions.ts (MAX_ATTACHMENTS_PER_MESSAGE/MESSAGE_ATTACHMENT_MAX_BYTES),
// hier los gehouden omdat het een ander soort upload is (openbare
// review-foto's, geen privé-berichtbijlage).
const MAX_REVIEW_PHOTOS = 4;
const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;

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
  photos?: File[];
  videoUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  // Een beoordeling is niet meer te wijzigen na het versturen (zie migratie
  // 0033) — dus liever hier vooraf een duidelijke foutmelding dan straks
  // een permanent opgeslagen review met een stille, genegeerde video-link.
  let videoUrl: string | null = null;
  const rawVideoUrl = (input.videoUrl ?? "").trim();
  if (rawVideoUrl) {
    if (!getVideoEmbedUrl(rawVideoUrl)) {
      return { ok: false, error: "Deze videolink lijkt niet geldig (alleen YouTube/Vimeo)." };
    }
    videoUrl = rawVideoUrl;
  }

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

  // Foto's die te groot zijn worden gewoon overgeslagen (net als bij
  // MessageComposer.tsx's client-zijde check) i.p.v. de hele beoordeling te
  // blokkeren — de gebruiker heeft in de UI al een client-zijde melding
  // gezien voordat het zover kwam.
  const validPhotos = (input.photos ?? []).filter((f) => f && f.size > 0 && f.size <= MAX_REVIEW_PHOTO_BYTES && f.type.startsWith("image/")).slice(0, MAX_REVIEW_PHOTOS);
  const uploadedUrls = await Promise.all(validPhotos.map((f) => uploadSupplierFile(user.id, f, "review")));
  const photoUrls = uploadedUrls.filter((u): u is string => u !== null);

  const review = await submitReview({
    offerId: offer.id,
    eventId: event.id,
    supplierId: offer.supplierId,
    reviewerRole,
    rating,
    comment: comment.length > 0 ? comment : null,
    noShow: reviewerRole === "supplier" ? Boolean(input.noShow) : false,
    photoUrls,
    videoUrl,
  });
  if (!review) return { ok: false, error: "Opslaan is niet gelukt — mogelijk heb je deze boeking al beoordeeld." };

  revalidatePath(`/events/${event.id}/shortlist`);
  revalidatePath("/supplier/orders");
  revalidatePath(`/leveranciers/${offer.supplierId}`);
  return { ok: true };
}
