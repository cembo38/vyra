import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DeadlineCountdown } from "@/components/ui/Countdown";
import { SupplierOfferForm } from "@/components/app/SupplierOfferForm";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner, getSupplierLead, getSupplierOfferForRequest } from "@/lib/data/store";
import { EVENT_TYPE_LABELS, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/config";
import { ArrowLeft, CheckCircle2, MapPin, Users } from "lucide-react";

export const metadata = { title: "Aanvraag — Vyra voor leveranciers" };

export default async function SupplierRequestDetailPage(props: PageProps<"/supplier/requests/[id]">) {
  const { id } = await props.params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const lead = await getSupplierLead(supplier.id, id);
  if (!lead) notFound();

  const existingOffer = await getSupplierOfferForRequest(supplier.id, id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/supplier/requests" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint hover:text-ink">
        <ArrowLeft className="size-4" /> Terug naar aanvragen
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
            {SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}
            {lead.request.isDirect && <Badge tone="coral">Maatwerkaanvraag</Badge>}
          </p>
          <h1 className="mt-1 font-display text-2xl text-ink">{lead.event.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">{EVENT_TYPE_LABELS[lead.event.type]}</p>
        </div>
        {!existingOffer && <DeadlineCountdown deadlineIso={lead.request.deadlineAt} />}
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-display text-lg text-ink">Details van het evenement</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <Detail label="Datum" value={lead.event.date ?? "Nog niet bepaald"} />
          <Detail
            label="Locatie"
            value={lead.event.locationLabel ?? "Niet opgegeven"}
            icon={<MapPin className="size-3.5" />}
          />
          <Detail
            label="Gasten"
            value={
              lead.event.guestCountAdults != null
                ? `${lead.event.guestCountAdults}${lead.event.guestCountChildren ? ` + ${lead.event.guestCountChildren} kinderen` : ""}`
                : "Niet opgegeven"
            }
            icon={<Users className="size-3.5" />}
          />
          {lead.request.budgetCents && <Detail label="Budget-indicatie" value={formatCurrency(lead.request.budgetCents)} />}
        </div>

        {lead.request.desiredService && (
          <div className="mt-4 border-t border-line-soft pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Gevraagde dienst</p>
            <p className="mt-1 text-sm text-ink-soft">{lead.request.desiredService}</p>
          </div>
        )}
        {lead.request.specialRequests && (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Bijzondere wensen</p>
            <p className="mt-1 text-sm text-ink-soft">{lead.request.specialRequests}</p>
          </div>
        )}
      </Card>

      <div className="mt-6">
        {existingOffer ? (
          <Card className="flex items-center gap-3 border-success-50 bg-success-50">
            <CheckCircle2 className="size-5 text-success" />
            <div>
              <p className="font-medium text-ink">Je hebt al een offerte ingediend voor deze aanvraag</p>
              <p className="text-sm text-ink-soft">Verstuurd voor {formatCurrency(existingOffer.totalPriceCents)}. <Badge tone="neutral" className="ml-1">Status: {existingOffer.status}</Badge></p>
            </div>
          </Card>
        ) : (
          <SupplierOfferForm requestId={lead.request.id} eventId={lead.event.id} categoryKey={lead.request.categoryKey} />
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-ink">{icon}{value}</p>
    </div>
  );
}
