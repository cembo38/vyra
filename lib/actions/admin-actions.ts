"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAILS, GalleryTier } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { geocodeLocation } from "@/lib/geo";
import {
  approveSupplierVerification,
  rejectSupplierVerification,
  revokeSupplierVerification,
  pushNotification,
  resolveAccountDeletionRequest,
  resolveDispute,
  setFeedbackReportStatus,
  resolveSpotlightBoostRequest,
  resolveTierUpgradeRequest,
  generateAndStoreDailyBriefing,
  markBriefingItemStatus,
  listAllSupplierAccounts,
  updateSupplierAccount,
  adminActivateGalleryForTesting,
  adminResetGalleryForTesting,
} from "@/lib/data/store";

/**
 * Elke actie hier raakt ANDERE gebruikers dan de aanroeper — dus altijd
 * eerst zelf verifiëren dat de aanroeper daadwerkelijk een admin is
 * (los van of de UI-knop al alleen op /admin staat, want een Server
 * Action is los aan te roepen). Gooit een gewone Error als dat niet zo
 * is — `runAction()` hieronder vangt die af en zet 'm om in een
 * gewoon geretourneerd resultaat.
 */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    throw new Error("Niet geautoriseerd.");
  }
  return user;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Belangrijke bugfix: elke actie hieronder gooide voorheen rechtstreeks
 * een `Error` bij een probleem (bv. "Je kunt jezelf niet blokkeren"),
 * afgevangen met een `try`/`catch` aan de clientkant. In Next.js 16 wordt
 * de boodschap van een Error die een Server Action ECHT gooit (i.p.v.
 * teruggeeft) in productie standaard vervangen door een onleesbare
 * generieke tekst ("Minified React error #441...") — zie
 * node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
 * ("For these errors, avoid using try/catch blocks and throw errors.
 * Instead, model expected errors as return values."). Live getest op
 * vyra.now: elke foutmelding in dit bestand kwam bij Cem als die
 * cryptische tekst binnen i.p.v. de bedoelde Nederlandse uitleg.
 *
 * Deze wrapper lost dat structureel op: de interne logica mag gewoon
 * `throw new Error("...")` blijven gebruiken (leesbaar, geen grote
 * herschrijving nodig), maar de EXPORTED action zelf gooit nooit meer —
 * hij vangt de throw af en geeft 'm terug als gewone data
 * (`{ ok: false, error: "..." }`), precies zoals `fileDisputeAction` in
 * lib/actions/dispute-actions.ts dat al langer deed. Retourwaarden worden
 * door Next.js NIET geredigeerd, dus de echte boodschap komt nu altijd aan.
 */
async function runAction(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Dit is niet gelukt." };
  }
}

export async function banUserAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const admin = await requireAdmin();
    const userId = String(formData.get("userId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    if (!userId) throw new Error("Geen gebruiker opgegeven.");
    if (userId === admin.id) throw new Error("Je kunt jezelf niet blokkeren.");

    const supabase = createSupabaseAdminClient();
    if (!supabase) throw new Error("Service-role sleutel niet geconfigureerd — kan geen gebruikers blokkeren (zie melding bovenaan het admin-dashboard).");

    // Livegang-audit (aug. 2026): de check hierboven voorkomt alleen dat een
    // admin ZICHZELF blokkeert — als er ooit een tweede echte admin bijkomt
    // (zie ADMIN_EMAILS in lib/config.ts) kon admin A per ongeluk admin B via
    // deze lijst blokkeren, waarna B's eigen `getCurrentUser()` hem meteen
    // uitlogt (banned_at wordt daar los van de ADMIN_EMAILS-check al
    // gecontroleerd) — een admin die zichzelf niet meer kan uitloggen zonder
    // dat er nog een derde admin is om het weer terug te draaien.
    const { data: targetProfile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
    if (targetProfile?.email && ADMIN_EMAILS.includes(String(targetProfile.email).toLowerCase())) {
      throw new Error("Dit account is zelf een Vyra-admin en kan niet geblokkeerd worden.");
    }

    const { error } = await supabase
      .from("profiles")
      .update({ banned_at: new Date().toISOString(), ban_reason: reason || null })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/gebruikers");
  });
}

export async function unbanUserAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const userId = String(formData.get("userId") ?? "").trim();
    if (!userId) throw new Error("Geen gebruiker opgegeven.");

    const supabase = createSupabaseAdminClient();
    if (!supabase) throw new Error("Service-role sleutel niet geconfigureerd.");

    const { error } = await supabase.from("profiles").update({ banned_at: null, ban_reason: null }).eq("id", userId);
    if (error) throw new Error(error.message);

    revalidatePath("/admin/gebruikers");
  });
}

/**
 * Test-toggle (sep. 2026, zie AdminGalleryTestPanel.tsx op
 * app/events/[id]/gallery/page.tsx): activeert een gastenfoto-pagina/
 * uitnodiging voor een evenement zonder Stripe. Nodig zolang
 * GALLERY_PURCHASE_ENABLED (lib/config.ts) uit staat — tot er echte
 * Stripe-sleutels zijn, is dit de ENIGE manier om ooit bij Premium te
 * komen en dus de uitnodiging te kunnen instellen, ook voor Cem zelf. Puur
 * voor testen: dit knopje staat alleen op de admin-toolbar bovenaan de
 * gastenfoto-pagina, nooit ergens waar een gewone organisator 'm kan zien.
 */
export async function adminActivateGalleryAction(eventId: string, tier: GalleryTier): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const result = await adminActivateGalleryForTesting(eventId, tier);
    if (!result.ok) throw new Error(result.error ?? "Activeren is mislukt.");
    revalidatePath(`/events/${eventId}/gallery`);
  });
}

/** Tegenhanger: zet de testpagina terug op "nog niet gekocht" — bv. om ook de koopflow (de pakketkaarten) terug te zien. */
export async function adminResetGalleryAction(eventId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const result = await adminResetGalleryForTesting(eventId);
    if (!result.ok) throw new Error(result.error ?? "Resetten is mislukt.");
    revalidatePath(`/events/${eventId}/gallery`);
  });
}

export async function approveSupplierVerificationAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
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

    revalidatePath("/admin/leveranciers");
  });
}

export async function rejectSupplierVerificationAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
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

    revalidatePath("/admin/leveranciers");
  });
}

/**
 * Trekt een eerder toegekende verificatie weer in — zie de toelichting bij
 * `revokeSupplierVerification()` in lib/data/store.ts voor waarom dit
 * ontbrak. Reversibel (de leverancier kan opnieuw verificatie aanvragen),
 * dus geen "typ ter bevestiging"-stap nodig — wel een lichte inline
 * bevestiging in de UI zelf (zie AdminRevokeVerificationButton.tsx),
 * zelfde soort patroon als blokkeren/deblokkeren van een gebruiker.
 */
export async function revokeSupplierVerificationAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const supplierId = String(formData.get("supplierId") ?? "").trim();
    if (!supplierId) throw new Error("Geen leverancier opgegeven.");

    const supplier = await revokeSupplierVerification(supplierId);
    if (!supplier) throw new Error("Kon verificatie niet intrekken (service-role sleutel niet geconfigureerd?).");

    await pushNotification({
      userId: supplier.ownerId,
      eventId: null,
      type: "verification_revoked",
      title: "Verificatie ingetrokken",
      body: "Vyra heeft je verificatiebadge ingetrokken. Neem contact op als je denkt dat dit niet klopt, of vraag verificatie opnieuw aan vanuit je bedrijfsprofiel.",
      href: "/supplier/profile",
    });

    revalidatePath("/admin/leveranciers");
  });
}

/**
 * Geschillen oplossen/afwijzen (spec-item #50) — mirror van
 * approve/rejectSupplierVerificationAction hierboven. Een reactie is
 * verplicht: zowel de organisator als de leverancier moeten begrijpen
 * waarom Cem tot dit oordeel kwam. resolveDispute() in lib/data/store.ts
 * notificeert beide partijen zelf.
 */
export async function resolveDisputeAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const disputeId = String(formData.get("disputeId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!disputeId) throw new Error("Geen geschil opgegeven.");
    if (!adminResponse) throw new Error("Geef een toelichting op je beslissing.");

    const dispute = await resolveDispute(disputeId, "resolved", adminResponse);
    if (!dispute) throw new Error("Kon geschil niet oplossen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/geschillen");
  });
}

export async function dismissDisputeAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const disputeId = String(formData.get("disputeId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!disputeId) throw new Error("Geen geschil opgegeven.");
    if (!adminResponse) throw new Error("Geef een toelichting op je beslissing.");

    const dispute = await resolveDispute(disputeId, "dismissed", adminResponse);
    if (!dispute) throw new Error("Kon geschil niet afwijzen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/geschillen");
  });
}

/**
 * Abonnements-upgrade goed-/afkeuren (livegang-audit augustus 2026) —
 * mirror van resolveDisputeAction/dismissDisputeAction hierboven. Bij
 * goedkeuring zet resolveTierUpgradeRequest() in lib/data/store.ts het
 * abonnement meteen echt om; een toelichting is bij afwijzen verplicht
 * (dezelfde reden als bij een geschil: de leverancier moet begrijpen
 * waarom), bij goedkeuren optioneel.
 */
export async function approveTierUpgradeRequestAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const requestId = String(formData.get("requestId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!requestId) throw new Error("Geen aanvraag opgegeven.");

    const request = await resolveTierUpgradeRequest(requestId, "approved", adminResponse || null);
    if (!request) throw new Error("Kon aanvraag niet goedkeuren (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/leveranciers");
  });
}

export async function declineTierUpgradeRequestAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const requestId = String(formData.get("requestId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!requestId) throw new Error("Geen aanvraag opgegeven.");
    if (!adminResponse) throw new Error("Geef een toelichting op je afwijzing.");

    const request = await resolveTierUpgradeRequest(requestId, "declined", adminResponse);
    if (!request) throw new Error("Kon aanvraag niet afwijzen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/leveranciers");
  });
}

export async function approveSpotlightBoostRequestAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const requestId = String(formData.get("requestId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!requestId) throw new Error("Geen aanvraag opgegeven.");

    const request = await resolveSpotlightBoostRequest(requestId, "approved", adminResponse || null);
    if (!request) throw new Error("Kon aanvraag niet goedkeuren (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/leveranciers");
  });
}

export async function declineSpotlightBoostRequestAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const requestId = String(formData.get("requestId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!requestId) throw new Error("Geen aanvraag opgegeven.");
    if (!adminResponse) throw new Error("Geef een toelichting op je afwijzing.");

    const request = await resolveSpotlightBoostRequest(requestId, "declined", adminResponse);
    if (!request) throw new Error("Kon aanvraag niet afwijzen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/leveranciers");
  });
}

/**
 * Keurt Cem een verwijderingsverzoek goed, dan is de daadwerkelijke
 * verwijdering (nog) een handmatige vervolgstap in het Supabase-dashboard
 * — zie de uitleg bij resolveAccountDeletionRequest() in lib/data/store.ts.
 * Deze actie zet alleen de status om, zodat de gebruiker weet dat zijn
 * verzoek is gezien en wat de vervolgstap is.
 */
export async function approveAccountDeletionRequestAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const requestId = String(formData.get("requestId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!requestId) throw new Error("Geen verzoek opgegeven.");

    const request = await resolveAccountDeletionRequest(requestId, "approved", adminResponse || null);
    if (!request) throw new Error("Kon verzoek niet goedkeuren (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/gebruikers");
  });
}

export async function declineAccountDeletionRequestAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const requestId = String(formData.get("requestId") ?? "").trim();
    const adminResponse = String(formData.get("adminResponse") ?? "").trim();
    if (!requestId) throw new Error("Geen verzoek opgegeven.");
    if (!adminResponse) throw new Error("Geef een toelichting op je afwijzing.");

    const request = await resolveAccountDeletionRequest(requestId, "declined", adminResponse);
    if (!request) throw new Error("Kon verzoek niet afwijzen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/gebruikers");
  });
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
export async function approveBriefingSupplierAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
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
    revalidatePath("/admin/leveranciers");
  });
}

export async function rejectBriefingSupplierAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
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
    revalidatePath("/admin/leveranciers");
  });
}

/** Rapportpunt uit de lijst halen zonder de onderliggende data aan te raken — zie uitleg hierboven. */
export async function dismissBriefingItemAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const itemId = String(formData.get("itemId") ?? "").trim();
    if (!itemId) throw new Error("Geen rapportpunt opgegeven.");

    await markBriefingItemStatus(itemId, "dismissed");
    revalidatePath("/admin");
  });
}

/** Handmatig een vers dagrapport genereren — voor het allereerste rapport, of als Cem tussendoor iets wil zien zonder op de nachtelijke cronjob te wachten. */
export async function generateBriefingNowAction(): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const briefing = await generateAndStoreDailyBriefing();
    if (!briefing) throw new Error("Kon geen rapport genereren (service-role sleutel niet geconfigureerd?).");
    revalidatePath("/admin");
  });
}

/**
 * Eenmalige "inhaalslag" voor "Locatie op een kaart" — leveranciers die zich
 * al vóór deze feature registreerden (of hun locatie nooit meer wijzigden)
 * hebben nog geen lat/lng, want die worden alleen bepaald bij het
 * aanmaken/wijzigen van het profiel (zie geocodeLocation() in lib/geo.ts,
 * aangeroepen vanuit lib/actions/supplier-actions.ts). Zonder deze knop
 * zouden ze pas een marker krijgen zodra ze zelf ooit hun profiel weer
 * opslaan.
 *
 * Verwerkt bewust een klein aantal per klik (niet alles in één keer): het
 * gratis Nominatim vereist ~1 aanvraag per seconde, en een groot aantal
 * suppliers in één serverless functie-aanroep zou het tijdslimiet van
 * Cems hostingplan kunnen raken. Simpelweg de knop nog eens klikken pakt de
 * volgende batch op.
 */
const GEOCODE_BACKFILL_BATCH_SIZE = 8;

export async function backfillSupplierCoordinatesAction(): Promise<
  ActionResult & { processed?: number; geocoded?: number; remaining?: number }
> {
  try {
    await requireAdmin();
    const all = await listAllSupplierAccounts();
    const missing = all.filter((s) => (s.lat == null || s.lng == null) && s.baseLocation.trim().length > 0);
    const batch = missing.slice(0, GEOCODE_BACKFILL_BATCH_SIZE);

    let geocoded = 0;
    for (const supplier of batch) {
      const coords = await geocodeLocation(supplier.baseLocation);
      if (coords) {
        await updateSupplierAccount(supplier.id, { lat: coords.lat, lng: coords.lng });
        geocoded += 1;
      } else {
        // Onherkend adres — niet blijven proberen, anders raakt deze
        // leverancier bij elke volgende klik weer de batch kwijt aan een
        // adres dat toch nooit gaat lukken. lat/lng blijven dan simpelweg
        // null (geen marker, wel gewoon vindbaar via de lijst).
      }
      // Fair-use van Nominatim respecteren: max. ~1 aanvraag/seconde.
      if (batch.indexOf(supplier) < batch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    revalidatePath("/admin/leveranciers");
    revalidatePath("/leveranciers");
    return { ok: true, processed: batch.length, geocoded, remaining: missing.length - batch.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Dit is niet gelukt." };
  }
}

/**
 * Een feedback-melding (vraag of bug, via de FAB op elke pagina) markeren
 * als afgehandeld. Zelfde patroon als resolveDisputeAction, maar zonder
 * verplichte toelichting — dit gaat naar niemand anders dan Cem zelf, een
 * korte interne notitie is optioneel.
 */
export async function resolveFeedbackReportAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const reportId = String(formData.get("reportId") ?? "").trim();
    if (!reportId) throw new Error("Geen melding opgegeven.");
    const adminNote = String(formData.get("adminNote") ?? "").trim() || null;

    const ok = await setFeedbackReportStatus(reportId, "resolved", adminNote);
    if (!ok) throw new Error("Kon melding niet afhandelen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/feedback");
  });
}

export async function reopenFeedbackReportAction(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireAdmin();
    const reportId = String(formData.get("reportId") ?? "").trim();
    if (!reportId) throw new Error("Geen melding opgegeven.");

    const ok = await setFeedbackReportStatus(reportId, "open", null);
    if (!ok) throw new Error("Kon melding niet heropenen (service-role sleutel niet geconfigureerd?).");

    revalidatePath("/admin/feedback");
  });
}
