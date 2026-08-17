import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/send";
import { EMAIL_ENABLED } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";

/**
 * Dagelijkse herinnering: aanvragen waarvan de reactietermijn van 48 uur is
 * verstreken zonder reactie van de leverancier.
 *
 * Waarom dit een aparte cronjob is (en niet gewoon hetzelfde stuk code als
 * `ensureAutoNotifications()` in lib/data/store.ts): die functie draait
 * alleen "lazy", op het moment dat een al-ingelogde gebruiker zijn eigen
 * meldingen ophaalt (topbar bij paginabezoek) — en precies de mensen die
 * dit het hardst nodig hebben, zijn degenen die NIET meer inloggen. Deze
 * route draait platformbreed (via de service-role-client, dus los van elke
 * ingelogde sessie) en bereikt dus ook wie al dagen niet is teruggeweest.
 *
 * Gebruikt bewust dezelfde `dedupe_key`-conventie ("req-overdue-<id>", zie
 * migratie 0005) als de bestaande lazy-check, zodat iemand nooit twéé keer
 * dezelfde herinnering krijgt — via welke van de twee paden ook het eerst
 * langskomt. De unieke index op (user_id, dedupe_key) is de daadwerkelijke
 * garantie hiervoor (23505 bij een dubbele poging), niet deze code zelf.
 *
 * Ingepland via vercel.json (elke dag 08:00 UTC). Beveiligd met CRON_SECRET
 * zoals Vercel Cron dat standaard verwacht: als die env var gezet is, moet
 * de request 'm meesturen als "Authorization: Bearer <CRON_SECRET>".
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

  const { data: overdue, error } = await supabase
    .from("requests")
    .select("id, event_id, category_key, deadline_at, status, events(id, owner_id, name, stage)")
    .in("status", ["sent", "awaiting_response"])
    .lt("deadline_at", new Date().toISOString());

  if (error) {
    console.error("[cron/deadline-reminders] ophalen mislukt:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let notified = 0;
  let emailed = 0;

  for (const row of overdue ?? []) {
    // Supabase-js geeft een geneste relatie als object terug (niet array)
    // bij een to-one-relatie zoals requests -> events via event_id.
    const event = row.events as unknown as { id: string; owner_id: string; name: string; stage: string } | null;
    if (!event || event.stage === "completed" || event.stage === "cancelled") continue;

    const dedupeKey = `req-overdue-${row.id}`;
    const title = "Nog geen reactie van leverancier";
    const body = `De reactietermijn van 48 uur voor ${SUPPLIER_CATEGORY_LABELS[row.category_key as SupplierCategory] ?? row.category_key} bij "${event.name}" is verstreken.`;
    const href = `/events/${event.id}/requests`;

    const { data: inserted, error: insertError } = await supabase
      .from("notifications")
      .insert({ user_id: event.owner_id, event_id: event.id, type: "deadline_approaching", title, body, href, dedupe_key: dedupeKey })
      .select("id")
      .maybeSingle();

    // 23505 = unique_violation: deze herinnering bestond al (via de lazy
    // check of een vorige cron-run) — geen nieuwe e-mail nodig.
    if (insertError && insertError.code !== "23505") {
      console.error(`[cron/deadline-reminders] melding voor aanvraag ${row.id} mislukt:`, insertError.message);
      continue;
    }
    if (!inserted) continue;
    notified++;

    if (EMAIL_ENABLED) {
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", event.owner_id).maybeSingle();
      if (profile?.email) {
        await sendNotificationEmail({ to: profile.email, title, body, href });
        emailed++;
      }
    }
  }

  return NextResponse.json({ checked: overdue?.length ?? 0, notified, emailed });
}
