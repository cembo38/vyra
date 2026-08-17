"use server";

import { revalidatePath } from "next/cache";
import { addMessage, getEvent, getSupplierAccountByOwner, pushNotification } from "@/lib/data/store";
import { getCurrentUser } from "@/lib/auth";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";

export async function sendMessageAction(eventId: string, categoryKey: SupplierCategory, supplierId: string, text: string) {
  if (!text.trim()) return;
  const event = await getEvent(eventId);
  if (!event) return;
  await addMessage({ eventId, categoryKey, supplierId, sender: "customer", text: text.trim() });
  revalidatePath(`/events/${eventId}/messages`, "layout");
}

/**
 * Tegenhanger van `sendMessageAction`, maar dan vanaf de leverancierskant —
 * tot nu toe kon een leverancier een gesprek alleen lezen, nooit reageren.
 * Controleert expliciet dat de aanroeper ook echt de leverancier is voor
 * wie dit gesprek is (niet alleen "is dit een leverancier"), zodat een
 * verkeerd/ontbrekend account een duidelijke fout geeft in plaats van een
 * stil door RLS geblokkeerde, lege insert — zelfde aanpak als
 * `requireAdmin()` in `lib/actions/admin-actions.ts`.
 */
export async function sendSupplierMessageAction(eventId: string, categoryKey: SupplierCategory, supplierId: string, text: string) {
  if (!text.trim()) return;

  const user = await getCurrentUser();
  if (!user) throw new Error("Niet ingelogd.");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier || supplier.id !== supplierId) throw new Error("Niet geautoriseerd voor dit gesprek.");

  const event = await getEvent(eventId);
  if (!event) throw new Error("Evenement niet gevonden.");

  await addMessage({ eventId, categoryKey, supplierId, sender: "supplier", text: text.trim() });

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
}
