import { NextRequest, NextResponse } from "next/server";
import { deleteExpiredGalleriesFromCron } from "@/lib/data/store";

/**
 * Dagelijkse opschoning van gastenfoto-pagina's waarvan de bewaartermijn is
 * verstreken (Deel C.4) — verwijdert de foto's/video's/gastenboek-berichten
 * en zet de pagina op "verlopen". Zie deleteExpiredGalleriesFromCron in
 * lib/data/store.ts voor de kernlogica; deze route is bewust dun, zelfde
 * opzet als de andere cronjobs hieronder.
 *
 * Ingepland via vercel.json (elke dag 03:30 UTC — buiten de drukte van de
 * andere cronjobs om 05:00/07:00/08:00/09:00 UTC). Beveiligd met
 * CRON_SECRET, zelfde "faalt dicht zonder de env var"-aanpak als
 * app/api/cron/deadline-reminders/route.ts.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteExpiredGalleriesFromCron();
  return NextResponse.json(result);
}
