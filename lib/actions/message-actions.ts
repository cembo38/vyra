"use server";

import { revalidatePath } from "next/cache";
import { addMessage, getEvent, getSupplierAccountByOwner, pushNotification, uploadMessageAttachment } from "@/lib/data/store";
import { getCurrentUser } from "@/lib/auth";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";

// Max. aantal bijlages per bericht — een hard plafond, los van de
// bestandsgrootte-grens per stuk (zie MESSAGE_ATTACHMENT_MAX_BYTES in
// lib/data/store.ts), zodat iemand niet in één keer tientallen bestanden
// tegelijk kan uploaden.
const MAX_ATTACHMENTS_PER_MESSAGE = 5;

async function uploadValidAttachments(eventId: string, supplierId: string, files: File[]): Promise<{ storagePath: string; fileName: string; mimeType: string; sizeBytes: number }[]> {
  const trimmed = files.filter((f) => f instanceof File && f.size > 0).slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  // Vóórdat een categorie een leverancier heeft (nog geen match/offerte),
  // bestaat er geen `supplierId` om het opslagpad — en dus de RLS-scoping —
  // aan te koppelen (zie de "" fallback in app/events/[id]/messages/[category]/page.tsx).
  // In dat randgeval slaan we bijlages stilzwijgend over i.p.v. te falen —
  // de tekst van het bericht gaat gewoon door.
  if (!supplierId || trimmed.length === 0) return [];
  const uploaded = await Promise.all(trimmed.map((f) => uploadMessageAttachment(eventId, supplierId, f)));
  return uploaded.filter((u): u is { storagePath: string; fileName: string; mimeType: string; sizeBytes: number } => Boolean(u));
}

/**
 * Had, in tegenstelling tot `sendSupplierMessageAction` hieronder, HELEMAAL
 * geen controle wie er aanroept — elke ingelogde gebruiker die een
 * eventId/categoryKey/supplierId kon raden of aflezen (bv. uit de URL van
 * andermans gesprek) kon zo een bericht "namens" die organisator in diens
 * gesprek met een leverancier plaatsen. De pagina die dit aanroept
 * (`/events/[id]/messages/[category]`) checkt zelf wel eigenaarschap via
 * `app/events/[id]/layout.tsx`, maar een Server Action is een eigen,
 * rechtstreeks aanroepbaar eindpunt — die bescherming van de pagina erft
 * niet automatisch mee naar de action zelf. Zelfde patroon nu toegepast
 * als overal elders (lib/actions/event-actions.ts, marketplace-actions.ts).
 *
 * `files` (spec: "bijlages foto/pdf in berichten") is optioneel — een
 * bericht met alleen een foto en geen tekst moet ook kunnen, dus alleen
 * wanneer ZOWEL tekst als bijlages ontbreken doen we niets.
 */
export async function sendMessageAction(
  eventId: string,
  categoryKey: SupplierCategory,
  supplierId: string,
  text: string,
  files: File[] = []
): Promise<{ ok: boolean; error?: string }> {
  const hasFiles = files.some((f) => f instanceof File && f.size > 0);
  if (!text.trim() && !hasFiles) return { ok: true };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const event = await getEvent(eventId);
  if (!event) return { ok: false, error: "Evenement niet gevonden." };
  if (event.ownerId !== user.id) return { ok: false, error: "Niet geautoriseerd voor dit gesprek." };

  const attachments = await uploadValidAttachments(eventId, supplierId, files);
  if (hasFiles && supplierId && attachments.length === 0) return { ok: false, error: "Bijlage uploaden is niet gelukt (max. 8MB, alleen foto's of pdf's)." };

  await addMessage({ eventId, categoryKey, supplierId, sender: "customer", text: text.trim() }, attachments);
  revalidatePath(`/events/${eventId}/messages`, "layout");
  return { ok: true };
}

/**
 * Tegenhanger van `sendMessageAction`, maar dan vanaf de leverancierskant —
 * tot nu toe kon een leverancier een gesprek alleen lezen, nooit reageren.
 * Controleert expliciet dat de aanroeper ook echt de leverancier is voor
 * wie dit gesprek is (niet alleen "is dit een leverancier"), zodat een
 * verkeerd/ontbrekend account een duidelijke fout geeft in plaats van een
 * stil door RLS geblokkeerde, lege insert — zelfde aanpak als
 * `requireAdmin()` in `lib/actions/admin-actions.ts`.
 *
 * Geeft `{ ok: false, error }` terug i.p.v. te gooien: Next.js 16
 * redigeert de boodschap van een echt gegooide Error uit een Server
 * Action in productie naar een onleesbare generieke tekst (zie de
 * uitleg bij `runAction()` in lib/actions/admin-actions.ts) — dat bleek
 * hier ook live het geval te zijn.
 */
export async function sendSupplierMessageAction(
  eventId: string,
  categoryKey: SupplierCategory,
  supplierId: string,
  text: string,
  files: File[] = []
): Promise<{ ok: boolean; error?: string }> {
  const hasFiles = files.some((f) => f instanceof File && f.size > 0);
  if (!text.trim() && !hasFiles) return { ok: true };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier || supplier.id !== supplierId) return { ok: false, error: "Niet geautoriseerd voor dit gesprek." };

  const event = await getEvent(eventId);
  if (!event) return { ok: false, error: "Evenement niet gevonden." };

  const attachments = await uploadValidAttachments(eventId, supplierId, files);
  if (hasFiles && supplierId && attachments.length === 0) return { ok: false, error: "Bijlage uploaden is niet gelukt (max. 8MB, alleen foto's of pdf's)." };

  await addMessage({ eventId, categoryKey, supplierId, sender: "supplier", text: text.trim() }, attachments);

  // Organisator een seintje geven — zonder dit blijft een reactie van de
  // leverancier onopgemerkt, want die kijkt niet standaard opnieuw in het
  // gesprek (zelfde patroon als bij een nieuwe offerte, zie `submitSupplierOffer`).
  await pushNotification({
    userId: event.ownerId,
    eventId: event.id,
    type: "supplier_question",
    title: "Nieuw bericht van leverancier",
    body: `${supplier.companyName} heeft gereageerd in het gesprek over ${SUPPLIER_CATEGORY_LABELS[categoryKey]}.`,
    href: `/events/${eventId}/messages/${categoryKey}`,
  });

  revalidatePath(`/events/${eventId}/messages`, "layout");
  revalidatePath("/supplier/messages", "layout");
  return { ok: true };
}
