import Link from "next/link";
import { notFound } from "next/navigation";
import { getDisputesForPayment, getEvent, getOffer, getPaymentsForOffer, getPayment, resolveSupplierDisplay } from "@/lib/data/store";
import { Card } from "@/components/ui/Card";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { formatCurrency } from "@/lib/config";
import { confirmPaymentAction } from "@/lib/actions/marketplace-actions";
import { DisputeReporter } from "@/components/app/DisputeReporter";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";

export default async function CheckoutPage(props: PageProps<"/events/[id]/checkout/[paymentId]">) {
  const { id, paymentId } = await props.params;
  const event = await getEvent(id);
  const payment = await getPayment(paymentId);
  if (!event || !payment || payment.eventId !== id) notFound();

  const offer = await getOffer(payment.offerId);
  const supplier = offer ? await resolveSupplierDisplay(offer.supplierId) : null;
  const disputes = payment.status === "paid" ? await getDisputesForPayment(payment.id) : [];
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
      <h1 className="mb-1 font-display text-2xl text-ink">{installmentLabel ? `Boeking bevestigen — ${installmentLabel.toLowerCase()}` : "Boeking bevestigen"}</h1>
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
          <div className="flex justify-between border-t border-line-soft pt-2.5 text-base font-semibold">
            <span className="text-ink">Afgesproken bedrag</span>
            <span className="text-ink">{formatCurrency(payment.totalCents)}</span>
          </div>
        </div>

        {/*
          Vyra verwerkt op dit moment nog geen betalingen zelf (zie de
          toelichting bij `confirmPaymentAction` in
          lib/actions/marketplace-actions.ts) — deze knop deed voorheen
          niets anders dan de status op "betaald" zetten, terwijl er
          "Veilig betalen via Stripe" bij stond. Dat was misleidend: er werd
          nooit geld verwerkt, met of zonder Stripe-sleutel. Nu eerlijk: het
          volledige bedrag (zonder aftrek van platformkosten, want die int
          Vyra vooralsnog niet) reken je rechtstreeks af met de leverancier.
        */}
        <div className="mt-4 rounded-xl bg-paper-dim px-3.5 py-3 text-sm text-ink-soft">
          <p>
            Vyra verwerkt op dit moment nog geen betalingen via het platform. Reken dit bedrag rechtstreeks af met{" "}
            <span className="font-medium text-ink">{supplier?.companyName ?? "de leverancier"}</span> — bijvoorbeeld via bankoverschrijving. Spreek samen af hoe en wanneer.
          </p>
          <Link
            href={`/events/${event.id}/messages/${payment.categoryKey}`}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-clay hover:underline"
          >
            <MessageCircle className="size-3.5" /> Betaling afstemmen in het gesprek
          </Link>
        </div>

        {otherInstallment && (
          <p className="mt-2.5 flex items-center gap-2 rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs text-ink-faint">
            {otherInstallment.status === "paid" ? (
              <>
                <CheckCircle2 className="size-3.5 shrink-0 text-success" />
                {otherInstallment.installment === "deposit" ? "Aanbetaling" : "Restbedrag"} van {formatCurrency(otherInstallment.totalCents)} is al bevestigd.
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
            <CheckCircle2 className="size-4.5" /> Boeking bevestigd op {new Date(payment.paidAt!).toLocaleDateString("nl-NL")}
          </div>
        ) : blockedByUnpaidDeposit ? (
          <div className="mt-6 flex items-center gap-2 rounded-xl bg-paper-dim px-4 py-3 text-sm text-ink-soft">
            <Clock className="size-4.5 shrink-0" /> Rond eerst de aanbetaling af — daarna kun je hier het restbedrag bevestigen.
          </div>
        ) : (
          <form action={confirmPaymentAction.bind(null, payment.id)} className="mt-6">
            <button type="submit" className="lift-hover flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-clay-dark">
              <CheckCircle2 className="size-4" /> Bevestig {installmentLabel ? `${installmentLabel.toLowerCase()} van ` : ""}{formatCurrency(payment.totalCents)}
            </button>
            <p className="mt-3 text-center text-xs text-ink-faint">
              Dit bevestigt de boeking in Vyra. De betaling zelf regel je rechtstreeks met de leverancier.
            </p>
          </form>
        )}
      </Card>

      {payment.status === "paid" && offer && (
        <DisputeReporter paymentId={payment.id} eventId={event.id} offerId={offer.id} supplierId={offer.supplierId} disputes={disputes} />
      )}
    </div>
  );
}
