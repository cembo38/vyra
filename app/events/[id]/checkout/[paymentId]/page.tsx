import { notFound } from "next/navigation";
import { getEvent, getOffer, getPaymentsForOffer, getPayment, resolveSupplierDisplay } from "@/lib/data/store";
import { Card } from "@/components/ui/Card";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { formatCurrency, PLATFORM_COMMISSION_RATE, PAYMENTS_ENABLED } from "@/lib/config";
import { confirmPaymentAction } from "@/lib/actions/marketplace-actions";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { CheckCircle2, Clock, Lock, ShieldCheck } from "lucide-react";

export default async function CheckoutPage(props: PageProps<"/events/[id]/checkout/[paymentId]">) {
  const { id, paymentId } = await props.params;
  const event = await getEvent(id);
  const payment = await getPayment(paymentId);
  if (!event || !payment || payment.eventId !== id) notFound();

  const offer = await getOffer(payment.offerId);
  const supplier = offer ? await resolveSupplierDisplay(offer.supplierId) : null;
  const siblings = payment.installment !== "full" ? await getPaymentsForOffer(payment.offerId) : [];
  const otherInstallment = siblings.find((p) => p.id !== payment.id);
  const installmentLabel = payment.installment === "deposit" ? "Aanbetaling" : payment.installment === "balance" ? "Restbedrag" : null;
  // Het restbedrag kan pas betaald worden nadat de aanbetaling betaald is
  // (ook server-side afgedwongen in markPaymentPaid) — hier alvast de knop
  // verbergen zodat de gebruiker niet op een actie kan klikken die toch
  // stilzwijgend niets doet.
  const blockedByUnpaidDeposit = payment.installment === "balance" && otherInstallment?.installment === "deposit" && otherInstallment.status !== "paid";

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 font-display text-2xl text-ink">{installmentLabel ? `Afrekenen — ${installmentLabel.toLowerCase()}` : "Afrekenen"}</h1>
      <p className="mb-6 text-sm text-ink-faint">{SUPPLIER_CATEGORY_LABELS[payment.categoryKey]} voor {event.name}</p>

      <Card>
        {supplier && (
          <div className="mb-5 flex items-center gap-3 border-b border-line-soft pb-5">
            <SupplierAvatar gradient={supplier.photoGradient} initials={supplier.initials} imageUrl={supplier.logoUrl} verified={supplier.verified} />
            <div>
              <p className="font-medium text-ink">{supplier.companyName}</p>
              <p className="text-sm text-ink-faint">{SUPPLIER_CATEGORY_LABELS[payment.categoryKey]}</p>
            </div>
          </div>
        )}

        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between"><span className="text-ink-soft">Leveranciersbedrag</span><span className="text-ink">{formatCurrency(payment.supplierAmountCents)}</span></div>
          <div className="flex justify-between">
            <span className="text-ink-soft">Platformkosten ({(payment.commissionRate * 100).toFixed(1)}%)</span>
            <span className="text-ink">{formatCurrency(payment.platformFeeCents)}</span>
          </div>
          <div className="flex justify-between border-t border-line-soft pt-2.5 text-base font-semibold">
            <span className="text-ink">Totaal</span>
            <span className="text-ink">{formatCurrency(payment.totalCents)}</span>
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs text-ink-faint">
          Vyra rekent {(PLATFORM_COMMISSION_RATE * 100).toFixed(1)}% platformkosten over elke transactie. Dit bedrag is vooraf zichtbaar, zonder verrassingen achteraf.
        </p>

        {otherInstallment && (
          <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs text-ink-faint">
            {otherInstallment.status === "paid" ? (
              <>
                <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                {otherInstallment.installment === "deposit" ? "Aanbetaling" : "Restbedrag"} van {formatCurrency(otherInstallment.totalCents)} is al betaald.
              </>
            ) : (
              <>
                <Clock className="size-3.5 shrink-0" />
                {otherInstallment.installment === "deposit" ? "Aanbetaling" : "Restbedrag"} van {formatCurrency(otherInstallment.totalCents)} volgt nog apart.
              </>
            )}
          </p>
        )}

        {payment.status === "paid" ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4.5" /> Betaling bevestigd op {new Date(payment.paidAt!).toLocaleDateString("nl-NL")}
          </div>
        ) : blockedByUnpaidDeposit ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-paper-dim px-4 py-3 text-sm text-ink-soft">
            <Clock className="size-4.5 shrink-0" /> Rond eerst de aanbetaling af — daarna kun je hier het restbedrag betalen.
          </div>
        ) : (
          <form action={confirmPaymentAction.bind(null, payment.id)} className="mt-6">
            <button type="submit" className="lift-hover flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-clay-dark">
              <Lock className="size-4" /> Bevestig & betaal {installmentLabel ? `${installmentLabel.toLowerCase()} van ` : ""}{formatCurrency(payment.totalCents)}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
              <ShieldCheck className="size-3.5" />
              {PAYMENTS_ENABLED ? "Veilig betalen via Stripe" : "Demo-betaling — nog geen Stripe-sleutel geconfigureerd"}
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
