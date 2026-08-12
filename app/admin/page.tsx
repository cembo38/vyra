import { ReactNode } from "react";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { StageBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  allSuppliers,
  listAllEvents,
  listAllOffers,
  listAllPayments,
  listAllRequests,
  listAllUsers,
} from "@/lib/data/store";
import { formatCurrency, PLATFORM_COMMISSION_RATE } from "@/lib/config";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { AlertCircle, Building2, CalendarDays, LineChart, Percent, Star, Users } from "lucide-react";

export const metadata = { title: "Admin — Vyra" };

export default function AdminPage() {
  const events = listAllEvents();
  const payments = listAllPayments();
  const suppliers = allSuppliers();
  const requests = listAllRequests();
  const offers = listAllOffers();
  const users = listAllUsers();

  const paidPayments = payments.filter((p) => p.status === "paid");
  const gmv = paidPayments.reduce((sum, p) => sum + p.supplierAmountCents, 0);
  const revenue = paidPayments.reduce((sum, p) => sum + p.platformFeeCents, 0);
  const eventsWithBudget = events.filter((e) => e.budget);
  const avgEventValue = eventsWithBudget.length ? eventsWithBudget.reduce((s, e) => s + (e.budget?.totalCents ?? 0), 0) / eventsWithBudget.length : 0;
  const avgResponseHours = suppliers.length ? suppliers.reduce((s, sup) => s + sup.avgResponseHours, 0) / suppliers.length : 0;
  const conversionRate = requests.length ? (paidPayments.length / requests.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-paper">
      <AppTopBar />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-ink">Platform overzicht</h1>
        <p className="mt-1 text-ink-soft">Admin-dashboard — geaggregeerde data over het hele platform.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<LineChart className="size-4" />} label="GMV" value={formatCurrency(gmv)} />
          <Kpi icon={<Percent className="size-4" />} label="Platform revenue" value={formatCurrency(revenue)} sub={`${(PLATFORM_COMMISSION_RATE * 100).toFixed(1)}% commissie`} />
          <Kpi icon={<CalendarDays className="size-4" />} label="Evenementen" value={String(events.length)} />
          <Kpi icon={<Building2 className="size-4" />} label="Leveranciers" value={String(suppliers.length)} />
          <Kpi icon={<Users className="size-4" />} label="Gebruikers" value={String(users.length)} />
          <Kpi icon={<LineChart className="size-4" />} label="Conversieratio" value={`${conversionRate.toFixed(0)}%`} sub="Betaald / aanvragen" />
          <Kpi icon={<LineChart className="size-4" />} label="Gem. eventwaarde" value={formatCurrency(avgEventValue)} />
          <Kpi icon={<Star className="size-4" />} label="Gem. reactietijd" value={`${avgResponseHours.toFixed(0)} uur`} sub="Leveranciers" />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-display text-lg text-ink">Recente evenementen</h2>
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink">{e.name}</p>
                    <p className="text-xs text-ink-faint">{EVENT_TYPE_LABELS[e.type]} · {e.locationLabel ?? "onbekende locatie"}</p>
                  </div>
                  <StageBadge stage={e.stage} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-lg text-ink">Top leveranciers</h2>
            <div className="space-y-2">
              {[...suppliers]
                .sort((a, b) => b.ratingAvg - a.ratingAvg)
                .slice(0, 6)
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-ink">{s.companyName}</p>
                      <p className="text-xs text-ink-faint">{s.serviceAreas.join(", ")}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-ink-faint">
                      <Star className="size-3.5 fill-gold text-gold" /> {s.ratingAvg.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-display text-lg text-ink">Transacties</h2>
            {payments.length === 0 ? (
              <p className="text-sm text-ink-faint">Nog geen transacties.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-ink">{formatCurrency(p.totalCents)}</p>
                      <p className="text-xs text-ink-faint">Fee: {formatCurrency(p.platformFeeCents)}</p>
                    </div>
                    <span className={`text-xs font-medium ${p.status === "paid" ? "text-success" : "text-gold"}`}>{p.status === "paid" ? "Betaald" : "In behandeling"}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-lg text-ink">Geschillen</h2>
            <EmptyState icon={<AlertCircle className="size-6" />} title="Geen openstaande geschillen" description="Gemelde problemen tussen organisatoren en leveranciers verschijnen hier." />
          </Card>
        </div>

        <p className="mt-8 text-xs text-ink-faint">{offers.length} offertes verwerkt in totaal over alle evenementen.</p>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl text-ink">{value}</p>
      {sub && <p className="text-xs text-ink-faint">{sub}</p>}
    </Card>
  );
}
