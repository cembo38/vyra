import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeAvgResponseHours, type ResponseTimeMessage } from "@/lib/data/response-time";

/**
 * Dagelijkse herberekening van `suppliers.avg_response_hours` uit de ÉCHTE
 * berichtgeschiedenis, i.p.v. de handmatig ingevulde seed-waarde die dit
 * veld tot nu toe altijd is gebleven (nooit ergens geüpdatet na aanmaken).
 * Het "Reageert meestal binnen X uur"-label op een leveranciersprofiel
 * (app/leveranciers/[id]/page.tsx) was daardoor in feite verzonnen.
 *
 * Draait platformbreed via de service-role-client (geen ingelogde
 * gebruiker nodig) — zelfde reden en patroon als
 * app/api/cron/deadline-reminders/route.ts. De eigenlijke telling
 * (wanneer telt iets als "gereageerd", hoe worden meerdere
 * organisatorberichten vóór een antwoord behandeld) staat in
 * lib/data/response-time.ts, apart getest zonder Supabase nodig te hebben.
 *
 * Leveranciers zonder berichtgeschiedenis (of die nog nooit hebben
 * geantwoord) worden bewust ONGEMOEID gelaten — `computeAvgResponseHours`
 * geeft dan `null`, en dat wordt hier NIET naar 0 uur omgezet, want dat
 * zou zo iemand onterecht als razendsnel laten ogen.
 *
 * Ingepland via vercel.json (elke dag 05:00 UTC, vóór de andere twee
 * cronjobs). Beveiligd met CRON_SECRET zoals Vercel Cron dat standaard
 * verwacht — dezelfde env var als de bestaande cronjobs.
 */
export async function GET(request: NextRequest) {
  // Livegang-audit (aug. 2026): dit faalde voorheen OPEN als CRON_SECRET
  // niet gezet was (`cronSecret &&` liet de hele check dan gewoon vallen) —
  // zonder deze env var in Vercel stond deze route dus voor IEDEREEN op
  // internet open, geen inloggegevens nodig. Nu dicht bij twijfel: ontbreekt
  // CRON_SECRET, dan wordt elk verzoek geweigerd i.p.v. toegelaten. Vergeet
  // je CRON_SECRET in Vercel te zetten, dan draait deze cronjob dus gewoon
  // niet (401) totdat je dat doet — vervelend te merken, maar nooit onveilig.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY niet geconfigureerd" });
  }

  const { data: rows, error } = await supabase
    .from("messages")
    .select("supplier_id, event_id, category_key, sender, created_at")
    .in("sender", ["customer", "supplier"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[cron/recompute-response-times] ophalen berichten mislukt:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Groepeer per leverancier, en binnen elke leverancier per gesprek
  // (event+categorie — `messages` heeft geen apart thread-id, zie migratie
  // 0001). De rijen kwamen al oplopend op `created_at` binnen, dus elke
  // deelverzameling hierbeneden blijft ook oplopend gesorteerd.
  const bySupplier = new Map<string, Map<string, ResponseTimeMessage[]>>();
  for (const row of rows ?? []) {
    const supplierId = row.supplier_id as string;
    const threadKey = `${row.event_id}:${row.category_key}`;
    let threads = bySupplier.get(supplierId);
    if (!threads) {
      threads = new Map();
      bySupplier.set(supplierId, threads);
    }
    let thread = threads.get(threadKey);
    if (!thread) {
      thread = [];
      threads.set(threadKey, thread);
    }
    thread.push({ sender: row.sender as ResponseTimeMessage["sender"], createdAt: row.created_at as string });
  }

  let updated = 0;
  for (const [supplierId, threads] of bySupplier) {
    const avgHours = computeAvgResponseHours(Array.from(threads.values()));
    if (avgHours === null) continue;

    const { error: updateError } = await supabase.from("suppliers").update({ avg_response_hours: avgHours }).eq("id", supplierId);
    if (updateError) {
      console.error(`[cron/recompute-response-times] bijwerken leverancier ${supplierId} mislukt:`, updateError.message);
      continue;
    }
    updated++;
  }

  return NextResponse.json({ suppliersMetGesprekken: bySupplier.size, updated });
}
