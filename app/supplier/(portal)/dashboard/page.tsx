import { redirect } from "next/navigation";
import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DeadlineCountdown } from "@/components/ui/Countdown";
import { StoreOpenToggle } from "@/components/app/StoreOpenToggle";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner, getSupplierEarningsSummary, getSupplierLeads, getSupplierOrders } from "@/lib/data/store";
import { formatCurrency } from "@/lib/config";
import { EVENT_TYPE_LABELS, SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { CalendarClock, CheckCircle2, Clock, Inbox, TrendingUp, Wallet } from "lucide-react";

export const metadata = { title: "Dashboard — Vyra voor leveranciers" };

export default async function SupplierDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const [summary, leads, orders] = await Promise.all([
    getSupplierEarningsSummary(supplier.id),
    getSupplierLeads(supplier.id),
    getSupplierOrders(supplier.id),
  ]);

  const openLeads = leads.filter((l) => l.target.status === "pending").slice(0, 5);
  const upcomingOrders = [...orders]
    .filter((o) => o.event?.date)
    .sort((a, b) => new Date(a.event!.date!).getTime() - new Date(b.event!.date!).getTime())
    .slice(0, 5);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Welkom terug, {supplier.companyName}</h1>
          <p className="mt-1 text-ink-soft">Overzicht van je aanvragen, boekingen en verdiensten.</p>
        </div>
        <StoreOpenToggle open={supplier.storeOpen} />
      </div>
      {!supplier.storeOpen && (
        <p className="mt-3 rounded-xl border border-line-soft bg-paper-dim px-3.5 py-2.5 text-sm text-ink-soft">
          Je winkel staat op gesloten — organisatoren kunnen je nu niet vinden via zoeken of nieuwe aanvragen. Zet &apos;m weer open zodra je nieuwe boekingen kunt aannemen.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Inbox className="size-4" />} label="Openstaande aanvragen" value={String(summary.openLeadsCount)} href="/supplier/requests" />
        <Kpi icon={<CheckCircle2 className="size-4" />} label="Actieve boekingen" value={String(summary.activeOrdersCount)} href="/supplier/orders" />
        <Kpi icon={<CalendarClock className="size-4" />} label="Deze maand" value={String(summary.upcomingThisMonthCount)} sub="Geboekte evenementen" />
        <Kpi icon={<TrendingUp className="size-4" />} label="Totaal verdiend" value={formatCurrency(summary.paidCents)} sub="Netto, na commissie" />
      </div>

      <Card className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-ink text-paper">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="text-sm text-white/70">In afwachting van uitbetaling</p>
            <p className="font-display text-2xl">{formatCurrency(summary.pendingCents)}</p>
          </div>
        </div>
        <p className="max-w-sm text-xs text-white/60">
          Dit bedrag staat klaar zodra de organisator heeft betaald. Uitbetaling via Stripe volgt automatisch zodra deze integratie live gaat — je hoeft hier zelf niets voor te doen.
        </p>
      </Card>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Nieuwe aanvragen</h2>
            <Link href="/supplier/requests" className="text-sm font-medium text-clay hover:underline">Alles bekijken</Link>
          </div>
          {openLeads.length === 0 ? (
            <EmptyState icon={<Inbox className="size-6" />} title="Geen openstaande aanvragen" description="Zodra een organisator een aanvraag stuurt die bij jouw profiel past, verschijnt die hier." />
          ) : (
            <div className="space-y-2">
              {openLeads.map((lead) => (
                <Link
                  key={lead.target.id}
                  href={`/supplier/requests/${lead.request.id}`}
                  className="block rounded-xl border border-line-soft px-3.5 py-2.5 text-sm transition-colors hover:border-sage"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{SUPPLIER_CATEGORY_LABELS[lead.request.categoryKey]}</p>
                      <p className="mt-0.5 font-medium text-ink">{lead.event.name}</p>
                    </div>
                    <DeadlineCountdown deadlineIso={lead.request.deadlineAt} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Aankomende boekingen</h2>
            <Link href="/supplier/orders" className="text-sm font-medium text-clay hover:underline">Alles bekijken</Link>
          </div>
          {upcomingOrders.length === 0 ? (
            <EmptyState icon={<Clock className="size-6" />} title="Nog geen boekingen" description="Zodra een organisator jouw offerte accepteert, verschijnt de boeking hier." />
          ) : (
            <div className="space-y-2">
              {upcomingOrders.map(({ offer, event, payment }) => (
                <div key={offer.id} className="flex items-center justify-between rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink">{event?.name ?? "Evenement"}</p>
                    <p className="text-xs text-ink-faint">{event ? EVENT_TYPE_LABELS[event.type] : ""} {event?.date ? `· ${event.date}` : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-ink">{formatCurrency(offer.totalPriceCents)}</p>
                    {/* "Uitbetaald" was hier onterecht — payment.status "paid"
                        betekent alleen dat de organisator heeft afgerekend,
                        niet dat het geld al is uitbetaald aan de leverancier
                        (zie de kaart hierboven en /supplier/orders). */}
                    <Badge tone={payment?.status === "paid" ? "success" : "ochre"}>{payment?.status === "paid" ? "Betaald — uitbetaling volgt" : "In behandeling"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub, href }: { icon: ReactNode; label: string; value: string; sub?: string; href?: string }) {
  const content = (
    <Card className={cn("p-4", href && "card-hover hover:border-clay/40")}>
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-faint">{sub}</p>}
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
