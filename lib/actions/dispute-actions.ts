"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { fileDispute, getEvent, getSupplierAccountByOwner } from "@/lib/data/store";
import type { DisputeCategory, DisputeFiledByRole } from "@/lib/types";

const DISPUTE_CATEGORIES: DisputeCategory[] = ["no_show", "quality", "payment", "communication", "other"];

/**
 * Spec-item #50 — geschil melden. Gebruikt door zowel de organisator
 * (vanaf de checkout-pagina) als de leverancier (vanaf zijn bestellingen-
 * pagina), via het gedeelde <DisputeReporter/>-component. RLS op de
 * `disputes`-tabel (0020_disputes.sql) voorkomt sowieso al dat iemand een
 * geschil meldt voor een boeking waar hij part noch deel aan heeft — deze
 * check hier bepaalt alleen welke van de twee rollen (`filedByRole`) van
 * toepassing is, wat de tekst/notificatie aan de andere partij bepaalt.
 */
export async function fileDisputeAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Je bent niet ingelogd." };

  const paymentId = String(formData.get("paymentId") ?? "").trim();
  const eventId = String(formData.get("eventId") ?? "").trim();
  const offerId = String(formData.get("offerId") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() as DisputeCategory;
  const description = String(formData.get("description") ?? "").trim();

  if (!paymentId || !eventId || !offerId || !supplierId) return { ok: false, error: "Onvolledige gegevens." };
  if (!DISPUTE_CATEGORIES.includes(category)) return { ok: false, error: "Kies een categorie." };
  if (description.length < 10) return { ok: false, error: "Beschrijf het probleem iets uitgebreider (minstens 10 tekens)." };

  const [event, supplierAccount] = await Promise.all([getEvent(eventId), getSupplierAccountByOwner(user.id)]);

  let filedByRole: DisputeFiledByRole;
  if (event && event.ownerId === user.id) {
    filedByRole = "customer";
  } else if (supplierAccount && supplierAccount.id === supplierId) {
    filedByRole = "supplier";
  } else {
    return { ok: false, error: "Je bent niet betrokken bij deze boeking." };
  }

  try {
    await fileDispute({ paymentId, eventId, offerId, supplierId, filedBy: user.id, filedByRole, category, description });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Kon geschil niet melden." };
  }

  revalidatePath(`/events/${eventId}/checkout/${paymentId}`);
  revalidatePath("/supplier/orders");
  return { ok: true };
}
