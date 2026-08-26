import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/send";
import { sendPushNotification } from "@/lib/push";
import { EMAIL_ENABLED, PUSH_ENABLED, TRIAL_BOOKING_COUNT } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

/**
 * Stuurt een e-mail + pushmelding(en) naar één ontvanger, náást de al
 * opgeslagen in-app-melding — spec-item #131. Faalt nooit hardop (zelfde
 * "best effort"-principe als sendNotificationEmail zelf): een hikkende
 * e-mail/push-provider mag nooit de rest van de cron-run laten mislukken.
 * Ruimt een verlopen push-abonnement meteen op (zie sendPushNotification)
 * i.p.v. daar bij de volgende run weer tegenaan te lopen.
 */
async function notifyOwnerByEmailAndPush(supabase: AdminClient, ownerId: string, msg: { title: string; body: string; href: string }) {
  if (EMAIL_ENABLED) {
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", ownerId).maybeSingle();
    if (profile?.email) await sendNotificationEmail({ to: profile.email, ...msg });
  }
  if (PUSH_ENABLED) {
    const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth_key").eq("user_id", ownerId);
    for (const sub of subs ?? []) {
      const result = await sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, authKey: sub.auth_key }, msg);
      if (result.expired) await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    }
  }
}

/**
 * "Proactieve signalen" (Enterprise-perk uit het VyrAI-leverancier-
 * voorstel, zie scratchpad/vyrai-leverancier-assistent-voorstel.html):
 * leveranciers met `assistantProactiveSignals: true` (Enterprise, én
 * iedereen die nog in de proefperiode zit — zie hieronder) krijgen
 * automatisch een melding bij (a) een aanvraag die binnen 24 uur verloopt
 * zonder reactie, en (b) een bevestigde boeking die binnen 7 dagen
 * plaatsvindt. Dit is dus dezelfde soort signalen als de dagelijkse
 * prioriteitenbriefing (zie computeSupplierBriefingSignals in
 * lib/data/store.ts), maar dan ONGEVRAAGD/op de achtergrond bezorgd i.p.v.
 * pas zichtbaar bij een paginabezoek — precies het verschil dat het
 * voorstel voor Enterprise belooft.
 *
 * Waarom dit NIET via lib/data/store.ts's sb()-gebaseerde helpers loopt
 * (getSupplierLeads, getSupplierOrders, checkSupplierAssistantAccess, ...):
 * die zijn allemaal sessie-gebonden (auth.uid() via cookies()) en er is in
 * een cronjob geen ingelogde gebruiker. Dit bestand volgt daarom exact
 * hetzelfde patroon als app/api/cron/deadline-reminders/route.ts en
 * app/api/cron/recompute-response-times/route.ts: platformbrede raw
 * queries via de service-role-client, en group-by-supplier in JS omdat
 * Supabase-js geen server-side GROUP BY kent.
 *
 * Voor "wie is Enterprise" wordt bewust NIET alleen op
 * `subscription_tier = 'enterprise'` gefilterd. Precies zoals
 * computeEffectiveTier() in lib/data/store.ts vastlegt, geldt de
 * proefperiode (nog geen TRIAL_BOOKING_COUNT geaccepteerde boekingen)
 * ALTIJD als volledige toegang, ongeacht het gekozen abonnement — dus ook
 * een Starter- of Pro-leverancier die nog in de proefperiode zit, krijgt
 * hier proactieve signalen. Dat is geen losse aanname maar de letterlijke
 * spiegeling van hoe lib/config.ts de trial-tier-definitie al opzet
 * (assistantProactiveSignals: true bij zowel enterprise als trial).
 *
 * Dedupe via de bestaande `notifications.dedupe_key` (migratie 0005,
 * unieke index op (user_id, dedupe_key)) — dezelfde beproefde aanpak als
 * deadline-reminders: een 23505-fout bij de insert betekent gewoon "deze
 * melding is al eerder verstuurd", geen echte fout.
 *
 * Ingepland via vercel.json, elke dag 09:00 UTC (na de andere drie
 * cronjobs, zodat recompute-response-times en deadline-reminders al up to
 * date zijn). Zelfde CRON_SECRET-beveiliging als de bestaande cronjobs.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY niet geconfigureerd" });
  }

  const { data: supplierRows, error: supplierError } = await supabase
    .from("suppliers")
    .select("id, owner_id, subscription_tier");
  if (supplierError) {
    console.error("[cron/supplier-proactive-signals] ophalen leveranciers mislukt:", supplierError.message);
    return NextResponse.json({ error: supplierError.message }, { status: 500 });
  }
  const suppliers = supplierRows ?? [];
  if (suppliers.length === 0) {
    return NextResponse.json({ eligibleSuppliers: 0, notified: 0 });
  }

  // Aantal geaccepteerde boekingen per leverancier — bepaalt (net als
  // computeEffectiveTier in lib/data/store.ts) of iemand nog in de
  // proefperiode zit. Eén platformbrede query i.p.v. één per leverancier.
  const { data: acceptedOfferRows, error: offersError } = await supabase
    .from("offers")
    .select("supplier_id")
    .eq("status", "accepted");
  if (offersError) {
    console.error("[cron/supplier-proactive-signals] ophalen boekingen mislukt:", offersError.message);
    return NextResponse.json({ error: offersError.message }, { status: 500 });
  }
  const acceptedCountBySupplier = new Map<string, number>();
  for (const row of acceptedOfferRows ?? []) {
    const supplierId = row.supplier_id as string;
    acceptedCountBySupplier.set(supplierId, (acceptedCountBySupplier.get(supplierId) ?? 0) + 1);
  }

  const eligibleSupplierIds = suppliers
    .filter((s) => {
      const acceptedCount = acceptedCountBySupplier.get(s.id as string) ?? 0;
      const inTrial = acceptedCount < TRIAL_BOOKING_COUNT;
      return inTrial || s.subscription_tier === "enterprise";
    })
    .map((s) => s.id as string);

  if (eligibleSupplierIds.length === 0) {
    return NextResponse.json({ eligibleSuppliers: 0, notified: 0 });
  }
  const ownerBySupplier = new Map(suppliers.map((s) => [s.id as string, s.owner_id as string]));

  let notified = 0;

  // ── Signaal 1: openstaande aanvragen die binnen 24 uur verlopen ──
  const { data: targetRows, error: targetsError } = await supabase
    .from("request_targets")
    .select("supplier_id, request:requests(id, event_id, category_key, deadline_at, status, event:events(name))")
    .in("supplier_id", eligibleSupplierIds)
    .eq("status", "pending");
  if (targetsError) {
    console.error("[cron/supplier-proactive-signals] ophalen aanvragen mislukt:", targetsError.message);
  }

  const now = Date.now();
  for (const row of targetRows ?? []) {
    // Supabase-js geeft een geneste relatie als object terug bij een
    // to-one-relatie (request_targets -> requests via request_id), en
    // requests -> events daarbinnen weer net zo.
    const req = row.request as unknown as {
      id: string;
      event_id: string;
      category_key: string;
      deadline_at: string;
      status: string;
      event: { name: string } | null;
    } | null;
    if (!req || (req.status !== "awaiting_response" && req.status !== "sent")) continue;
    const hoursLeft = (new Date(req.deadline_at).getTime() - now) / (1000 * 60 * 60);
    if (hoursLeft <= 0 || hoursLeft > 24) continue;

    const supplierId = row.supplier_id as string;
    const ownerId = ownerBySupplier.get(supplierId);
    if (!ownerId) continue;

    const categoryLabel = SUPPLIER_CATEGORY_LABELS[req.category_key as SupplierCategory] ?? req.category_key;
    const eventName = req.event?.name ?? "een evenement";
    const dedupeKey = `supplier-signal-lead-${req.id}`;
    const title = "VyrAI-signaal: aanvraag verloopt bijna";
    const body = `Je aanvraag "${categoryLabel}" voor ${eventName} verloopt over minder dan 24 uur — nog geen reactie verstuurd.`;
    const href = `/supplier/messages/${req.id}`;
    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "supplier_proactive_signal",
      title,
      body,
      href,
      dedupe_key: dedupeKey,
    });
    // 23505 = unique_violation: dit signaal is al eerder verstuurd voor
    // deze aanvraag, precies de bedoeling van de dedupe_key-constraint —
    // dus ook geen nieuwe e-mail/push bij een herhaalde cron-run.
    if (insertError) {
      if (insertError.code !== "23505") {
        console.error(`[cron/supplier-proactive-signals] melding voor aanvraag ${req.id} mislukt:`, insertError.message);
      }
      continue;
    }
    notified++;
    await notifyOwnerByEmailAndPush(supabase, ownerId, { title, body, href });
  }

  // ── Signaal 2: bevestigde boekingen die binnen 7 dagen plaatsvinden ──
  const { data: offerRows, error: upcomingError } = await supabase
    .from("offers")
    .select("id, supplier_id, category_key, event:events(name, date)")
    .in("supplier_id", eligibleSupplierIds)
    .eq("status", "accepted");
  if (upcomingError) {
    console.error("[cron/supplier-proactive-signals] ophalen aankomende boekingen mislukt:", upcomingError.message);
  }

  for (const row of offerRows ?? []) {
    const event = row.event as unknown as { name: string; date: string | null } | null;
    if (!event?.date) continue;
    const daysUntil = (new Date(event.date).getTime() - now) / (1000 * 60 * 60 * 24);
    if (daysUntil < 0 || daysUntil > 7) continue;

    const supplierId = row.supplier_id as string;
    const ownerId = ownerBySupplier.get(supplierId);
    if (!ownerId) continue;

    const categoryLabel = SUPPLIER_CATEGORY_LABELS[row.category_key as SupplierCategory] ?? row.category_key;
    const dedupeKey = `supplier-signal-booking-${row.id}`;
    const title = "VyrAI-signaal: boeking komt eraan";
    const body = `Je boeking "${categoryLabel}" voor ${event.name} vindt binnen 7 dagen plaats.`;
    const href = `/supplier/calendar`;
    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "supplier_proactive_signal",
      title,
      body,
      href,
      dedupe_key: dedupeKey,
    });
    if (insertError) {
      if (insertError.code !== "23505") {
        console.error(`[cron/supplier-proactive-signals] melding voor boeking ${row.id} mislukt:`, insertError.message);
      }
      continue;
    }
    notified++;
    await notifyOwnerByEmailAndPush(supabase, ownerId, { title, body, href });
  }

  return NextResponse.json({ eligibleSuppliers: eligibleSupplierIds.length, notified });
}
