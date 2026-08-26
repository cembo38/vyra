import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner, getSupplierOrders } from "@/lib/data/store";
import { EVENT_TYPE_LABELS, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";

/**
 * CSV-export van boekingen — spec-item #130. Bewust GEEN gegenereerde
 * "factuur"-PDF: Vyra verwerkt zelf geen betalingen (het geld gaat altijd
 * rechtstreeks tussen organisator en leverancier om, zie de toelichting op
 * /supplier/orders en de checkout-pagina), dus Vyra is geen partij die hier
 * een echte factuur voor kan/mag opstellen. Wél alle regels die een
 * leverancier voor zijn EIGEN administratie/boekhoudsoftware nodig heeft
 * (bedrag, datum, commissie, status) — net zo'n zelfbedienings-export als
 * /api/account/export, maar dan CSV i.p.v. JSON (bruikbaar in Excel/
 * boekhoudpakketten, waar een organisator niks aan zou hebben).
 */

function csvEscape(value: string | number): string {
  const str = String(value);
  // Alleen aanhalingstekens nodig als het veld een komma, aanhalingsteken of
  // regeleinde bevat — RFC 4180. Excel/Google Sheets/de meeste NL
  // boekhoudpakketten lezen dit probleemloos in.
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function centsToEuroString(cents: number): string {
  // Komma als decimaalteken (NL-notatie) — consistent met hoe formatCurrency
  // elders in de app bedragen toont, en wat NL boekhoudpakketten verwachten
  // bij CSV-import.
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Niet ingelogd." }, { status: 401 });

  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) return NextResponse.json({ error: "Geen leveranciersaccount gevonden." }, { status: 404 });

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : null;

  let orders = await getSupplierOrders(supplier.id);
  if (year) orders = orders.filter((o) => o.event?.date?.startsWith(year));
  orders = [...orders].sort((a, b) => (a.event?.date ?? "").localeCompare(b.event?.date ?? ""));

  const header = [
    "Datum evenement",
    "Evenement",
    "Type evenement",
    "Categorie",
    "Locatie",
    "Status betaling",
    "Totaalbedrag (organisator betaalt jou)",
    "Vyra-commissie",
    "Commissietarief",
    "Abonnementsniveau bij boeking",
    "Netto voor jou",
  ];

  const rows = orders.map(({ offer, event, payment }) => {
    const totalCents = payment?.totalCents ?? offer.totalPriceCents;
    // Zonder `payment`-rij (nog geen betaalverzoek aangemaakt) is er ook nog
    // geen commissie berekend — dan tonen we 0 i.p.v. te gokken, zodat dit
    // nooit een bedrag suggereert dat nog nergens is vastgelegd.
    const platformFeeCents = payment?.platformFeeCents ?? 0;
    const supplierAmountCents = payment?.supplierAmountCents ?? totalCents;
    return [
      event?.date ?? "",
      event?.name ?? "",
      event ? EVENT_TYPE_LABELS[event.type] : "",
      SUPPLIER_CATEGORY_LABELS[offer.categoryKey],
      event?.locationLabel ?? "",
      payment?.status === "paid" ? "Bevestigd door organisator" : payment ? "Wacht op bevestiging" : "Nog niet bevestigd",
      centsToEuroString(totalCents),
      centsToEuroString(platformFeeCents),
      payment ? `${(payment.commissionRate * 100).toFixed(1).replace(".", ",")}%` : "",
      payment?.commissionTier ?? "",
      centsToEuroString(supplierAmountCents),
    ];
  });

  // ﻿ (BOM): zonder dit opent Excel op Windows een UTF-8 CSV met
  // accenten (bv. "categorieën") soms als rommelige tekens — een bekende
  // Excel-eigenaardigheid, de BOM voorkomt dat.
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vyra-boekingen${year ? `-${year}` : ""}.csv"`,
    },
  });
}
