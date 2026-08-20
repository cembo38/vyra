import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreDailyBriefing } from "@/lib/data/store";

/**
 * Dagelijks AI-team-rapport voor de platformeigenaar (spec-item #52
 * vervolg) — genereert het rapport (zie generateAndStoreDailyBriefing()
 * in lib/data/store.ts) en mailt Cem een korte samenvatting met een link
 * naar het volledige rapport op /admin.
 *
 * Ingepland via vercel.json, elke ochtend om 07:00 UTC (08:00/09:00
 * Nederlandse tijd, afhankelijk van zomer-/wintertijd) — bewust vóór
 * kantoortijd, zodat het rapport er al staat als Cem voor het eerst die
 * dag kijkt. Zelfde beveiliging (CRON_SECRET) als de bestaande
 * deadline-reminders-cronjob hierboven.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const briefing = await generateAndStoreDailyBriefing();
  if (!briefing) {
    return NextResponse.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY niet geconfigureerd" });
  }

  return NextResponse.json({ briefingId: briefing.id, items: briefing.items.length, usedAI: briefing.usedAI });
}
