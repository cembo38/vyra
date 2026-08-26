"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { requestAccountDeletion } from "@/lib/data/store";

/**
 * "Zelfbedienings AVG-export/verwijderen" (livegang-audit) — het
 * self-service deel is dit verzoek indienen; de daadwerkelijke verwijdering
 * verloopt daarna via Cem's beoordeling op /admin/gebruikers (zie
 * resolveAccountDeletionRequest in lib/data/store.ts). Zelfde reden als bij
 * een abonnementsupgrade-aanvraag: dit is onomkeerbaar en kan lopende
 * boekingen/betalingen/geschillen raken, dus geen directe cascade-delete
 * vanuit een enkele klik.
 */
export async function requestAccountDeletionAction(reason: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Niet ingelogd." };

  const request = await requestAccountDeletion(user.id, reason.trim() || null);
  if (!request) return { ok: false, error: "Je hebt al een openstaand verwijderingsverzoek — dat wordt binnenkort beoordeeld." };

  revalidatePath("/profile");
  revalidatePath("/supplier/profile");
  return { ok: true };
}
