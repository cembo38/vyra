import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DisputeReporter } from "@/components/app/DisputeReporter";
import { getCurrentUser } from "@/lib/auth";
import { getDisputesForSupplier, getSupplierAccountByOwner, getSupplierOrders } from "@/lib/data/store";
import { Dispute, EVENT_TYPE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/config";
import { CalendarCheck } from "lucide-react";

export const metadata = { title: "Orders — Vyra voor leveranciers" };

export default async function SupplierOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const [orders, disputes] = await Promise.all([getSupplierOrders(supplier.id), getDisputesForSupplier(supplier.id)]);
  const disputesByPayment = new Map<string, Dispute[]>();
  for (const d of disputes) {
    disputesByPayment.set(d.paymentId, [...(disputesByPayment.get(d.paymentId) ?? []), d]);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = orders
    .filter((o) => !o.event?.date || new Date(o.event.date) >= today)
    .sort((a, b) => (a.event?.date ?? "").localeCompare(b.event?.date ?? ""));
  const past = orders
    .filter((o) => o.event?.date && new Date(o.event.date) < today)
    .sort((a, b) => (b.event?.date ?? "").localeCompare(a.event?.date ?? ""));

  // Het volledige bedrag (totalCents), niet alleen het supplier-deel na
  // commissie — zolang Vyra zelf geen betalingen verwerkt, ontvangt de
  // leverancier dit hele bedrag rechtstreeks van de organisator.
  const totalPaid = orders.filter((o) => o.payment?.status === "paid").reduce((sum, o) => sum + (o.payment?.totalCents ?? 0), 0);
  const totalPending = orders.filter((o) => o.payment && o.payment.status !== "paid").reduce((sum, o) => sum + (o.payment?.totalCents ?? 0), 0);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Orders</h1>
      <p className="mt-1 text-ink-soft">Al je geaccepteerde boekingen, inclusief bevestigingsstatus.</p>

      {/*
        Vyra verwerkt op dit moment nog geen betalingen zelf — het geld gaat
        NOOIT via het platform, organisatoren rekenen rechtstreeks met de
        leverancier af (zie de toelichting op de checkout-pagina). Dit zei
        voorheen "uitbetaling aan jou volgt automatisch zodra Stripe live
        is" — die belofte klopte niet: Vyra ontvangt dit geld helemaal niet,
        dus kan het ook niet "uitbetalen". Voorlopig dus puur een overzicht
        van bevestigde vs. nog niet bevestigde boekingen, geen geldstroom
        via Vyra.
      */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Totaal bevestigd (rechtstreeks door organisator te betalen)</p>
          <p className="mt-1.5 font-display text-2xl text-ink">{formatCurrency(totalPaid)}</p>
          <p className="mt-0.5 text-xs text-ink-faint">Dit reken je rechtstreeks met de organisator af — Vyra houdt hier geen geld voor je vast.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Nog niet bevestigd door organisator</p>
          <p className="mt-1.5 font-display text-2xl text-ink">{formatCurrency(totalPending)}</p>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-display text-lg text-ink">Aankomend ({upcoming.length})</h2>
      {upcoming.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-6" />} title="Nog geen boekingen" description="Zodra een organisator jouw offerte accepteert, verschijnt de boeking hier." />
      ) : (
        <OrderTable orders={upcoming} supplierId={supplier.id} disputesByPayment={disputesByPayment} />
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-display text-lg text-ink">Afgerond ({past.length})</h2>
          <OrderTable orders={past} supplierId={supplier.id} disputesByPayment={disputesByPayment} />
        </>
      )}
    </div>
  );
}

function OrderTable({
  orders,
  supplierId,
  disputesByPayment,
}: {
  orders: Awaited<ReturnType<typeof getSupplierOrders>>;
  supplierId: string;
  disputesByPayment: Map<string, Dispute[]>;
}) {
  return (
    <div className="space-y-2">
      {orders.map(({ offer, event, payment }) => (
        <Card key={offer.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{event?.name ?? "Evenement"}</p>
              <p className="text-xs text-ink-faint">
                {event ? EVENT_TYPE_LABELS[event.type] : ""} {event?.date ? `· ${event.date}` : ""} {event?.locationLabel ? `· ${event.locationLabel}` : ""}
              </p>
            </div>
            <div className="text-right">
              {/* Het volledige bedrag (niet het supplier-deel na commissie) —
                  zolang Vyra geen betalingen zelf verwerkt, betaalt de
                  organisator dit hele bedrag rechtstreeks aan de leverancier,
                  zonder dat Vyra daar een deel van inhoudt. */}
              <p className="font-medium text-ink">{formatCurrency(payment?.totalCents ?? offer.totalPriceCents)}</p>
              <Badge tone={payment?.status === "paid" ? "success" : "ochre"}>
                {payment?.status === "paid" ? "Bevestigd door organisator" : payment ? "Wacht op bevestiging" : "Nog niet bevestigd"}
              </Badge>
            </div>
          </div>
          {payment && event && payment.status === "paid" && (
            <DisputeReporter
              paymentId={payment.id}
              eventId={event.id}
              offerId={offer.id}
              supplierId={supplierId}
              disputes={disputesByPayment.get(payment.id) ?? []}
            />
          )}
        </Card>
      ))}
    </div>
  );
}
