import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Dagelijkse herberekening van `suppliers.accepted_offer_rate` (en de
 * nieuwe begeleidende `offers_submitted_count`) uit de échte offertes van
 * elke leverancier — zelfde reden en exact hetzelfde patroon als
 * app/api/cron/recompute-response-times/route.ts: dit veld stond al sinds
 * het begin op elke leverancier (migratie 0002), maar werd voor échte
 * accounts nergens herberekend, terwijl de Pro-tier-tekst op
 * /supplier/analytics wél expliciet "acceptatiegraad t.o.v. het
 * categoriegemiddelde" belooft (zie lib/config.ts).
 *
 * Definitie: acceptatiegraad = aantal offertes met status "accepted" /
 * totaal aantal ooit ingediende offertes voor die leverancier. Leveranciers
 * zonder ooit ingediende offerte houden bewust hun default (0, 0) — de
 * consumerende code (getSupplierPerformanceInsights in lib/data/store.ts)
 * gebruikt `offers_submitted_count` om "0% acceptatie" te onderscheiden van
 * "nog geen offertes", en toont het laatste nooit als een percentage.
 *
 * Ingepland via vercel.json (elke dag 05:15 UTC, vlak na
 * recompute-response-times). Beveiligd met CRON_SECRET zoals de overige
 * cronjobs.
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

  const { data: rows, error } = await supabase.from("offers").select("supplier_id, status");
  if (error) {
    console.error("[cron/recompute-acceptance-rate] ophalen offertes mislukt:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bySupplier = new Map<string, { total: number; accepted: number }>();
  for (const row of rows ?? []) {
    const supplierId = row.supplier_id as string;
    const entry = bySupplier.get(supplierId) ?? { total: 0, accepted: 0 };
    entry.total++;
    if (row.status === "accepted") entry.accepted++;
    bySupplier.set(supplierId, entry);
  }

  let updated = 0;
  for (const [supplierId, { total, accepted }] of bySupplier) {
    // offers.supplier_id is tekst (ondersteunt ook de statische
    // demo-catalogus, zie migratie 0001) — een update tegen `suppliers.id`
    // (uuid) raakt simpelweg niets als de rij niet bestaat, geen foutmelding
    // nodig.
    const rate = total > 0 ? Number((accepted / total).toFixed(3)) : 0;
    const { error: updateError } = await supabase
      .from("suppliers")
      .update({ accepted_offer_rate: rate, offers_submitted_count: total })
      .eq("id", supplierId);
    if (updateError) {
      console.error(`[cron/recompute-acceptance-rate] bijwerken leverancier ${supplierId} mislukt:`, updateError.message);
      continue;
    }
    updated++;
  }

  return NextResponse.json({ suppliersMetOffertes: bySupplier.size, updated });
}
