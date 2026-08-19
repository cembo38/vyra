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

  const totalPaid = orders.filter((o) => o.payment?.status === "paid").reduce((sum, o) => sum + (o.payment?.supplierAmountCents ?? 0), 0);
  const totalPending = orders.filter((o) => o.payment && o.payment.status !== "paid").reduce((sum, o) => sum + (o.payment?.supplierAmountCents ?? 0), 0);

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Orders</h1>
      <p className="mt-1 text-ink-soft">Al je geaccepteerde boekingen, inclusief uitbetalingsstatus.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Totaal uitbetaald</p>
          <p className="mt-1.5 font-display text-2xl text-ink">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">In afwachting van uitbetaling</p>
          <p className="mt-1.5 font-display text-2xl text-ink">{formatCurrency(totalPending)}</p>
          <p className="mt-0.5 text-xs text-ink-faint">Uitbetaling volgt automatisch zodra Stripe live is.</p>
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
              <p className="font-medium text-ink">{formatCurrency(payment?.supplierAmountCents ?? offer.totalPriceCents)}</p>
              <Badge tone={payment?.status === "paid" ? "success" : "ochre"}>
                {payment?.status === "paid" ? "Uitbetaald" : payment ? "Wacht op uitbetaling" : "Betaling nog niet gestart"}
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
