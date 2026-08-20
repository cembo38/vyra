"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAILS } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  approveSupplierVerification,
  rejectSupplierVerification,
  pushNotification,
  resolveDispute,
  generateAndStoreDailyBriefing,
  markBriefingItemStatus,
} from "@/lib/data/store";

/**
 * Elke actie hier raakt ANDERE gebruikers dan de aanroeper — dus altijd
 * eerst zelf verifiëren dat de aanroeper daadwerkelijk een admin is
 * (los van of de UI-knop al alleen op /admin staat, want een Server
 * Action is los aan te roepen). Gooit een gewone Error als dat niet zo
 * is; `useTransition` aan de clientkant vangt dat gewoon op.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    throw new Error("Niet geautoriseerd.");
  }
  return user;
}

export async function banUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) throw new Error("Geen gebruiker opgegeven.");
  if (userId === admin.id) throw new Error("Je kunt jezelf niet blokkeren.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service-role sleutel niet geconfigureerd — kan geen gebruikers blokkeren (zie melding bovenaan het admin-dashboard).");

  const { error } = await supabase
    .from("profiles")
    .update({ banned_at: new Date().toISOString(), ban_reason: reason || null })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function unbanUserAction(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("Geen gebruiker opgegeven.");

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Service-role sleutel niet geconfigureerd.");

  const { error } = await supabase.from("profiles").update({ banned_at: null, ban_reason: null }).eq("id", userId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin");
}

export async function approveSupplierVerificationAction(formData: FormData) {
  await requireAdmin();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!supplierId) throw new Error("Geen leverancier opgegeven.");

  const supplier = await approveSupplierVerification(supplierId);
  if (!supplier) throw new Error("Kon leverancier niet verifiëren (service-role sleutel niet geconfigureerd?).");

  await pushNotification({
    userId: supplier.ownerId,
    eventId: null,
    type: "verification_approved",
    title: "Je bent geverifieerd!",
    body: "Vyra heeft je bedrijfsgegevens gecontroleerd — je profiel toont nu een verificatiebadge, wat vertrouwen wekt bij organisatoren.",
    href: "/supplier/profile",
  });

  revalidatePath("/admin");
}

export async function rejectSupplierVerificationAction(formData: FormData) {
  await requireAdmin();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!supplierId) throw new Error("Geen leverancier opgegeven.");

  const supplier = await rejectSupplierVerification(supplierId);
  if (!supplier) throw new Error("Kon verificatieaanvraag niet afwijzen (service-role sleutel niet geconfigureerd?).");

  await pushNotification({
    userId: supplier.ownerId,
    eventId: null,
    type: "verification_rejected",
    title: "Verificatieaanvraag afgewezen",
    body: "We konden je bedrijfsgegevens nog niet verifiëren. Controleer je KVK-nummer en bedrijfsgegevens en vraag het opnieuw aan.",
    href: "/supplier/profile",
  });

  revalidatePath("/admin");
}

/**
 * Geschillen oplossen/afwijzen (spec-item #50) — mirror van
 * approve/rejectSupplierVerificationAction hierboven. Een reactie is
 * verplicht: zowel de organisator als de leverancier moeten begrijpen
 * waarom Cem tot dit oordeel kwam. resolveDispute() in lib/data/store.ts
 * notificeert beide partijen zelf.
 */
export async function resolveDisputeAction(formData: FormData) {
  await requireAdmin();
  const disputeId = String(formData.get("disputeId") ?? "").trim();
  const adminResponse = String(formData.get("adminResponse") ?? "").trim();
  if (!disputeId) throw new Error("Geen geschil opgegeven.");
  if (!adminResponse) throw new Error("Geef een toelichting op je beslissing.");

  const dispute = await resolveDispute(disputeId, "resolved", adminResponse);
  if (!dispute) throw new Error("Kon geschil niet oplossen (service-role sleutel niet geconfigureerd?).");

  revalidatePath("/admin");
}

export async function dismissDisputeAction(formData: FormData) {
  await requireAdmin();
  const disputeId = String(formData.get("disputeId") ?? "").trim();
  const adminResponse = String(formData.get("adminResponse") ?? "").trim();
  if (!disputeId) throw new Error("Geen geschil opgegeven.");
  if (!adminResponse) throw new Error("Geef een toelichting op je beslissing.");

  const dispute = await resolveDispute(disputeId, "dismissed", adminResponse);
  if (!dispute) throw new Error("Kon geschil niet afwijzen (service-role sleutel niet geconfigureerd?).");

  revalidatePath("/admin");
}

/**
 * Acties voor het dagelijkse AI-team-rapport (spec-item #52 vervolg).
 *
 * Bewust twee verschillende soorten knoppen op een rapportpunt:
 * - "Goedkeuren"/"Afwijzen" bij een leveranciersverificatie voert de
 *   ECHTE actie meteen uit (net als de bestaande kaart verderop op de
 *   pagina — dit is gewoon een tweede plek om diezelfde actie te
 *   starten) én markeert het rapportpunt als afgehandeld.
 * - "Gezien/negeren" bij alle andere soorten punten (geschil, nieuwe
 *   aanmelding, financieel, AI-veiligheid) doet UITSLUITEND het
 *   rapportpunt verdwijnen uit de lijst — geen verborgen neveneffect op
 *   de onderliggende data. Een geschil bijvoorbeeld vereist altijd een
 *   geschreven toelichting (zie AdminDisputeActions hieronder) en kan
 *   dus niet met één generieke klik "opgelost" worden.
 */
export async function approveBriefingSupplierAction(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!itemId || !supplierId) throw new Error("Onvolledig rapportpunt.");

  const supplier = await approveSupplierVerification(supplierId);
  if (!supplier) throw new Error("Kon leverancier niet verifiëren (service-role sleutel niet geconfigureerd?).");

  await pushNotification({
    userId: supplier.ownerId,
    eventId: null,
    type: "verification_approved",
    title: "Je bent geverifieerd!",
    body: "Vyra heeft je bedrijfsgegevens gecontroleerd — je profiel toont nu een verificatiebadge, wat vertrouwen wekt bij organisatoren.",
    href: "/supplier/profile",
  });

  await markBriefingItemStatus(itemId, "approved");
  revalidatePath("/admin");
}

export async function rejectBriefingSupplierAction(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (!itemId || !supplierId) throw new Error("Onvolledig rapportpunt.");

  const supplier = await rejectSupplierVerification(supplierId);
  if (!supplier) throw new Error("Kon verificatieaanvraag niet afwijzen (service-role sleutel niet geconfigureerd?).");

  await pushNotification({
    userId: supplier.ownerId,
    eventId: null,
    type: "verification_rejected",
    title: "Verificatieaanvraag afgewezen",
    body: "We konden je bedrijfsgegevens nog niet verifiëren. Controleer je KVK-nummer en bedrijfsgegevens en vraag het opnieuw aan.",
    href: "/supplier/profile",
  });

  await markBriefingItemStatus(itemId, "dismissed");
  revalidatePath("/admin");
}

/** Rapportpunt uit de lijst halen zonder de onderliggende data aan te raken — zie uitleg hierboven. */
export async function dismissBriefingItemAction(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) throw new Error("Geen rapportpunt opgegeven.");

  await markBriefingItemStatus(itemId, "dismissed");
  revalidatePath("/admin");
}

/** Handmatig een vers dagrapport genereren — voor het allereerste rapport, of als Cem tussendoor iets wil zien zonder op de nachtelijke cronjob te wachten. */
export async function generateBriefingNowAction() {
  await requireAdmin();
  const briefing = await generateAndStoreDailyBriefing();
  if (!briefing) throw new Error("Kon geen rapport genereren (service-role sleutel niet geconfigureerd?).");
  revalidatePath("/admin");
}
