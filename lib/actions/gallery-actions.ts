"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  createOrUpdatePendingGalleryPurchase,
  deleteGalleryMessage,
  deleteGalleryPhoto,
  getEvent,
  getEventGallery,
  getGalleryPublic,
  removeInvitationPhoto,
  setGalleryMessageModeration,
  setGalleryPhotoModeration,
  setGalleryStripeCheckoutSessionId,
  setInvitationTemplate,
  submitGalleryMessage,
  submitGalleryPhoto,
  updateInvitationText,
  uploadGalleryMedia,
  uploadInvitationPhoto,
} from "@/lib/data/store";
import { GALLERY_TIERS, GalleryTier, SITE_URL } from "@/lib/config";
import { getStripeClient } from "@/lib/payments/stripe";
import { GalleryModerationStatus } from "@/lib/types";
import { INVITATION_TEMPLATES } from "@/lib/invitation-templates";

/**
 * Gastenfoto-pagina kopen ("Deel C") — eenmalige Stripe-betaling (mode
 * "payment", géén abonnement). Zelfde patroon als
 * changeSubscriptionTierAction in supplier-actions.ts, maar zonder de
 * abonnement-specifieke stukken (geen Stripe-klant nodig, geen
 * proratie-verrekening — dit is een losstaande, eenmalige aankoop).
 */
export async function startGalleryCheckoutAction(eventId: string, tier: GalleryTier): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event) return { ok: false, error: "Evenement niet gevonden." };
  if (!(tier in GALLERY_TIERS)) return { ok: false, error: "Onbekend pakket." };

  const stripe = getStripeClient();
  if (!stripe) return { ok: false, error: "Betalen is momenteel niet beschikbaar. Probeer het later opnieuw." };

  const gallery = await createOrUpdatePendingGalleryPurchase(eventId, tier);
  if (!gallery) return { ok: false, error: "Kon de gastenfoto-pagina niet klaarzetten. Probeer het nog eens." };
  if (gallery.status === "active") return { ok: false, error: "Er is al een actieve gastenfoto-pagina voor dit evenement." };

  const definition = GALLERY_TIERS[tier];

  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Vyra gastenfoto-pagina — ${definition.label}`, description: `Voor ${event.name}` },
            unit_amount: definition.priceCents,
          },
          quantity: 1,
        },
      ],
      metadata: { purpose: "gallery_purchase", galleryId: gallery.id, eventId, tier },
      success_url: `${SITE_URL}/events/${eventId}/gallery?purchaseSuccess=1`,
      cancel_url: `${SITE_URL}/events/${eventId}/gallery?purchaseCanceled=1`,
    });
    checkoutUrl = session.url;
    await setGalleryStripeCheckoutSessionId(gallery.id, session.id);
  } catch (err) {
    console.error("[startGalleryCheckoutAction] Stripe Checkout-sessie aanmaken mislukt:", err instanceof Error ? err.message : err);
    return { ok: false, error: "Er ging iets mis bij het aanmaken van de Stripe-betaalsessie. Probeer het nog eens." };
  }
  if (!checkoutUrl) return { ok: false, error: "Kon geen betaalsessie aanmaken bij Stripe. Probeer het nog eens." };
  redirect(checkoutUrl);
}

export async function moderateGalleryPhotoAction(eventId: string, photoId: string, status: GalleryModerationStatus) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await setGalleryPhotoModeration(photoId, status);
  revalidatePath(`/events/${eventId}/gallery`);
}

export async function deleteGalleryPhotoAction(eventId: string, photoId: string, storagePath: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await deleteGalleryPhoto(photoId, storagePath);
  revalidatePath(`/events/${eventId}/gallery`);
}

export async function moderateGalleryMessageAction(eventId: string, messageId: string, status: GalleryModerationStatus) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await setGalleryMessageModeration(messageId, status);
  revalidatePath(`/events/${eventId}/gallery`);
}

export async function deleteGalleryMessageAction(eventId: string, messageId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await deleteGalleryMessage(messageId);
  revalidatePath(`/events/${eventId}/gallery`);
}

/**
 * Publieke acties (géén login) — aangeroepen vanaf de gast-uploadpagina
 * `/gallery/[token]`. Zelfde beveiligingsgedachte als submitPublicRsvpAction
 * in guest-actions.ts: elke check die de client al doet, wordt hier
 * server-side herhaald, want een gast met een aangepast verzoek kan de
 * client-kant altijd omzeilen.
 */
export async function uploadGalleryPhotoAction(uploadToken: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gallery = await getGalleryPublic(uploadToken);
  if (!gallery || gallery.status !== "active") return { ok: false, error: "Deze gastenfoto-pagina is niet (meer) actief." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Kies eerst een foto of video." };

  const isVideo = file.type.startsWith("video/");
  if (isVideo && !gallery.allowVideo) return { ok: false, error: "Video-uploads zijn alleen beschikbaar bij Premium." };

  const maxBytes = gallery.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) return { ok: false, error: `Dit bestand is groter dan de toegestane ${gallery.maxUploadMb}MB.` };

  const guestName = String(formData.get("guestName") ?? "").trim().slice(0, 100);

  const uploaded = await uploadGalleryMedia(uploadToken, file, maxBytes);
  if (!uploaded) return { ok: false, error: "Uploaden is mislukt. Probeer het nog eens." };

  const ok = await submitGalleryPhoto(uploadToken, guestName, uploaded.storagePath, isVideo);
  if (!ok) return { ok: false, error: "Opslaan is mislukt. Probeer het nog eens." };

  revalidatePath(`/gallery/${uploadToken}`);
  return { ok: true };
}

export async function submitGalleryMessageAction(uploadToken: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const gallery = await getGalleryPublic(uploadToken);
  if (!gallery || gallery.status !== "active") return { ok: false, error: "Deze gastenfoto-pagina is niet (meer) actief." };
  if (!gallery.allowGuestbook) return { ok: false, error: "Het gastenboek is alleen beschikbaar bij Plus en Premium." };

  const message = String(formData.get("message") ?? "").trim().slice(0, 1000);
  if (!message) return { ok: false, error: "Schrijf eerst een bericht." };
  const guestName = String(formData.get("guestName") ?? "").trim().slice(0, 100);

  const ok = await submitGalleryMessage(uploadToken, guestName, message);
  if (!ok) return { ok: false, error: "Versturen is mislukt. Probeer het nog eens." };

  revalidatePath(`/gallery/${uploadToken}`);
  return { ok: true };
}

/**
 * Uitnodigingssjablonen (Deel C.5) — alleen bij Premium, en alleen op een
 * `active` gastenfoto-pagina van het eigen evenement (dubbele check: eerst
 * of het evenement van de aanroeper is, dan of het niveau het toestaat —
 * dezelfde volgorde als bij de video/gastenboek-server-checks hierboven).
 * Bewust ÉÉN gedeelde helper i.p.v. dat in elke actie te herhalen.
 */
async function requireOwnedPremiumGallery(eventId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(eventId);
  if (!event) throw new Error("Evenement niet gevonden.");
  const gallery = await getEventGallery(eventId);
  if (!gallery || gallery.status !== "active") throw new Error("Er is geen actieve gastenfoto-pagina voor dit evenement.");
  if (gallery.tier !== "premium") throw new Error("Uitnodigingssjablonen zijn alleen beschikbaar bij Premium.");
  return gallery;
}

export async function setInvitationTemplateAction(eventId: string, templateKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const gallery = await requireOwnedPremiumGallery(eventId);
    if (!INVITATION_TEMPLATES.some((t) => t.key === templateKey)) return { ok: false, error: "Onbekend sjabloon." };
    const ok = await setInvitationTemplate(gallery.id, templateKey);
    if (!ok) return { ok: false, error: "Opslaan is mislukt. Probeer het nog eens." };
    revalidatePath(`/events/${eventId}/gallery`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dit is niet gelukt." };
  }
}

export async function updateInvitationTextAction(eventId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const gallery = await requireOwnedPremiumGallery(eventId);
    const title = String(formData.get("title") ?? "").trim().slice(0, 120) || null;
    const welcomeText = String(formData.get("welcomeText") ?? "").trim().slice(0, 80) || null;
    const ok = await updateInvitationText(gallery.id, title, welcomeText);
    if (!ok) return { ok: false, error: "Opslaan is mislukt. Probeer het nog eens." };
    revalidatePath(`/events/${eventId}/gallery`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dit is niet gelukt." };
  }
}

export async function uploadInvitationPhotoAction(eventId: string, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const gallery = await requireOwnedPremiumGallery(eventId);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Kies eerst een foto." };
    if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Dit bestand is groter dan de toegestane 8MB." };
    const ok = await uploadInvitationPhoto(eventId, gallery.id, file);
    if (!ok) return { ok: false, error: "Uploaden is mislukt. Probeer het nog eens." };
    revalidatePath(`/events/${eventId}/gallery`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dit is niet gelukt." };
  }
}

export async function removeInvitationPhotoAction(eventId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const gallery = await requireOwnedPremiumGallery(eventId);
    if (!gallery.invitationPhotoPath) return { ok: true };
    const ok = await removeInvitationPhoto(gallery.id, gallery.invitationPhotoPath);
    if (!ok) return { ok: false, error: "Verwijderen is mislukt. Probeer het nog eens." };
    revalidatePath(`/events/${eventId}/gallery`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Dit is niet gelukt." };
  }
}
