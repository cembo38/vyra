import { NextResponse } from "next/server";
import { buildIcsCalendar, IcsEvent } from "@/lib/ical";
import { getSupplierAccount, getSupplierBlockedDates, getSupplierIdByIcalToken, getSupplierOrders } from "@/lib/data/store";

/**
 * Kalenderabonnement-feed (.ics) voor een leverancier — spec-item #128.
 * Bewust GEEN sessie/login: dit endpoint wordt aangeroepen door externe
 * agenda-apps (Apple/Google Kalender e.d.), die geen Vyra-cookie meesturen.
 * De ongokbare `token` in de URL zelf is de enige autorisatie — zie
 * `getSupplierIdByIcalToken` (loopt via de service-role-sleutel, want RLS
 * zou een sessieloze aanvraag anders altijd blokkeren) en de toelichting
 * bovenaan supabase/migrations/0046_....sql voor waarom de token in een
 * aparte, NIET publiek leesbare tabel staat i.p.v. een kolom op `suppliers`.
 *
 * Bevat: bevestigde boekingen + eenmalig geblokkeerde datums, allebei als
 * hele-dag "bezet"-afspraken (zie lib/ical.ts). Bewuste, benoemde beperking
 * van deze eerste versie: structureel geblokkeerde weekdagen
 * (`supplier_recurring_blocks`) zitten hier NIET in — die tellen al wél mee
 * bij matching (zie `getUnavailableSupplierIds` in lib/data/store.ts), maar
 * ze als wekelijks terugkerende RRULE-afspraken exporteren is losse,
 * aparte scope; geen stille omissie, alleen nog niet gebouwd.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/supplier/ical/[token]">) {
  const { token } = await ctx.params;

  const supplierId = await getSupplierIdByIcalToken(token);
  if (!supplierId) {
    return new NextResponse("Niet gevonden.", { status: 404 });
  }

  const supplier = await getSupplierAccount(supplierId);
  if (!supplier) {
    return new NextResponse("Niet gevonden.", { status: 404 });
  }

  const [orders, blockedDates] = await Promise.all([getSupplierOrders(supplierId), getSupplierBlockedDates(supplierId)]);

  const events: IcsEvent[] = [];
  for (const { offer, event } of orders) {
    if (!event?.date) continue;
    const timeRange = event.startTime && event.endTime ? ` (${event.startTime}–${event.endTime})` : "";
    events.push({
      uid: `booking-${offer.id}@vyra.now`,
      summary: `${event.name}${timeRange}`,
      description: "Bevestigde boeking via Vyra.",
      location: event.locationLabel ?? undefined,
      date: event.date,
    });
  }
  for (const blocked of blockedDates) {
    events.push({
      uid: `blocked-${supplierId}-${blocked.date}@vyra.now`,
      summary: "Niet beschikbaar (Vyra)",
      description: "Zelf ingestelde onbeschikbaarheid via Vyra.",
      date: blocked.date,
    });
  }

  const ics = buildIcsCalendar({
    calendarName: `Vyra — ${supplier.companyName}`,
    events,
    dtstamp: new Date(),
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vyra-agenda.ics"',
      "Cache-Control": "no-store",
    },
  });
}
