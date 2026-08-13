import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeadlineCountdown } from "@/components/ui/Countdown";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner, getSupplierLeads } from "@/lib/data/store";
import { EVENT_TYPE_LABELS, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/config";
import { CheckCircle2, Inbox } from "lucide-react";

export const metadata = { title: "Aanvragen — Vyra voor leveranciers" };

export default async function SupplierRequestsPage(props: PageProps<"/supplier/requests">) {
  const params = await props.searchParams;
  const justSent = params.sent === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const leads = await getSupplierLeads(supplier.id);
  const pending = leads.filter((l) => l.target.status === "pending");
  const responded = leads.filter((l) => l.target.status !== "pending");

  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Aanvragen</h1>
      <p className="mt-1 text-ink-soft">Aanvragen van organisatoren die matchen met jouw profiel.</p>

      {justSent && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> Je offerte is verstuurd naar de organisator.
        </div>
      )}

      <h2 className="mb-3 mt-8 font-display text-lg text-ink">Openstaand ({pending.length})</h2>
      {pending.length === 0 ? (
        <EmptyState icon={<Inbox className="size-6" />} title="Geen openstaande aanvragen" description="Zodra een organisator een aanvraag stuurt die bij jouw profiel past, verschijnt die hier." />
      ) : (
        <div className="space-y-2">
          {pending.map((lead) => (
            <Link
              key={lead.target.id}
              href={`/supplier/requests/${lead.request.id}`}
              className="card-hover block rounded-xl border border-line bg-white px-4 py-3.5 text-sm transition-colors hover:border-sage [box-shadow:var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                    {SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}
                    {lead.request.isDirect && <Badge tone="clay">Maatwerk</Badge>}
                  </p>
                  <p className="mt-0.5 font-display text-base text-ink">{lead.event.name}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{EVENT_TYPE_LABELS[lead.event.type]} {lead.event.date ? `· ${lead.event.date}` : ""} {lead.event.locationLabel ? `· ${lead.event.locationLabel}` : ""}</p>
                </div>
                <div className="text-right">
                  {lead.request.budgetCents && <p className="text-xs text-ink-faint">Budget-indicatie: {formatCurrency(lead.request.budgetCents)}</p>}
                  <DeadlineCountdown deadlineIso={lead.request.deadlineAt} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {responded.length > 0 && (
        <>
          <h2 className="mb-3 mt-10 font-display text-lg text-ink">Beantwoord ({responded.length})</h2>
          <div className="space-y-2">
            {responded.map((lead) => (
              <div key={lead.target.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft px-4 py-3.5 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}</p>
                  <p className="mt-0.5 font-medium text-ink">{lead.event.name}</p>
                </div>
                <Badge tone="success">Offerte verstuurd</Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
