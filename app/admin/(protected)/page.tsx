import { ReactNode } from "react";
import { AdminBriefingCard } from "@/components/app/AdminBriefingCard";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { StageBadge } from "@/components/ui/Badge";
import { getLatestAdminBriefing, listAllEvents, listAllOffers, listAllPayments, listAllRequests, listAllSupplierAccounts, listAllUsers } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { SUBSCRIPTION_TIER_LABELS, SUBSCRIPTION_TIER_ORDER, formatCurrency } from "@/lib/config";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { Building2, CalendarDays, LineChart, Percent, Star, Users, Wallet } from "lucide-react";

export const metadata = { title: "Overzicht — Vyra Admin" };

export default async function AdminOverviewPage() {
  const [events, payments, requests, offers, users, suppliers, briefing] = await Promise.all([
    listAllEvents(),
    listAllPayments(),
    listAllRequests(),
    listAllOffers(),
    listAllUsers(),
    listAllSupplierAccounts(),
    getLatestAdminBriefing(),
  ]);
  const serviceRoleConfigured = isServiceRoleConfigured();

  const paidPayments = payments.filter((p) => p.status === "paid");
  // GMV = het volledige bedrag dat organisatoren betalen (supplier-deel +
  // platformfee samen, "totalCents"), NIET alleen het supplier-deel — die
  // laatste stond hier per ongeluk, waardoor zowel de GMV-tegel als het
  // "blended"-commissiepercentage hieronder (revenue/gmv) stelselmatig te
  // hoog uitkwamen (een boeking van €100 supplier + €10 fee toonde 10%
  // i.p.v. de werkelijke 9,09%).
  const gmv = paidPayments.reduce((sum, p) => sum + p.totalCents, 0);
  const revenue = paidPayments.reduce((sum, p) => sum + p.platformFeeCents, 0);
  // Sinds het gestaffelde commissiemodel (spec-item #53) bestaat er geen
  // enkel vast percentage meer — hier het werkelijke, blended tarief over
  // alle betaalde boekingen, i.p.v. een hardcoded constante die niet meer
  // overal hetzelfde is.
  const blendedCommissionRate = gmv > 0 ? (revenue / gmv) * 100 : 0;
  // MRR (na de overstap op echte Stripe-facturering, aug. 2026): niet meer
  // de statische lijstprijs van het niveau, maar het ECHTE bedrag waar de
  // leverancier voor tekende (`subscription_price_cents`, vastgelegd op het
  // moment van afsluiten — kan afwijken van de huidige lijstprijs als die
  // later wijzigt). Een jaarabonnement wordt naar een maand-equivalent
  // omgerekend (/12) zodat maand- en jaarbetalers eerlijk worden opgeteld.
  // Instap-leveranciers hebben geen abonnementsprijs (0% commissie via
  // subscriptie, wél 9% commissie — die zit al in `revenue` hierboven).
  const mrrEstimateCents = suppliers.reduce((sum, s) => {
    if (!s.subscriptionPriceCents) return sum;
    return sum + (s.billingInterval === "annual" ? Math.round(s.subscriptionPriceCents / 12) : s.subscriptionPriceCents);
  }, 0);
  const tierDistribution = SUBSCRIPTION_TIER_ORDER.map((key) => ({
    key,
    label: SUBSCRIPTION_TIER_LABELS[key],
    count: suppliers.filter((s) => s.subscriptionTier === key).length,
  }));
  const eventsWithBudget = events.filter((e) => e.budget);
  const avgEventValue = eventsWithBudget.length ? eventsWithBudget.reduce((s, e) => s + (e.budget?.totalCents ?? 0), 0) / eventsWithBudget.length : 0;
  const avgResponseHours = suppliers.length ? suppliers.reduce((s, sup) => s + sup.avgResponseHours, 0) / suppliers.length : 0;
  // Een offerte die via het termijnenplan wordt betaald, staat als TWEE
  // aparte payment-rijen (aanbetaling + restbedrag) — die allebei meetellen
  // liet één betaalde boeking soms als "2" meetellen in de teller, wat de
  // conversieratio kunstmatig opblies. Tellen op basis van unieke offerte-
  // id's telt elke geconverteerde boeking maar één keer, ongeacht het
  // gekozen betaalplan.
  const paidOfferIds = new Set(paidPayments.map((p) => p.offerId));
  const conversionRate = requests.length ? (paidOfferIds.size / requests.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Platform overzicht</h1>
      <p className="mt-1 text-ink-soft">Geaggregeerde data over het hele platform.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      <div className="mt-8">
        <AdminBriefingCard briefing={briefing} />
      </div>

      {/*
        Zolang er geen betaaldienst is aangesloten (zie de toelichting op de
        checkout-pagina), int Vyra geen commissie: organisatoren betalen het
        volledige bedrag rechtstreeks aan de leverancier. GMV/revenue
        hieronder zijn dus de WAARDE van bevestigde boekingen en de
        commissie die erover zou gelden zodra online betalen live gaat —
        geen geld dat daadwerkelijk op Vyra's rekening staat.
      */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<LineChart className="size-4" />} label="GMV" value={formatCurrency(gmv)} sub="Waarde bevestigde boekingen" />
        <Kpi
          icon={<Percent className="size-4" />}
          label="Platform revenue"
          value={formatCurrency(revenue)}
          sub={gmv > 0 ? `${blendedCommissionRate.toFixed(1)}% blended — nog niet geïnd, zie toelichting` : "Nog geen bevestigde boekingen"}
        />
        <Kpi
          icon={<Wallet className="size-4" />}
          label="MRR (indicatief)"
          value={formatCurrency(mrrEstimateCents)}
          sub="O.b.v. gekozen niveau — nog geen automatische incasso"
        />
        <Kpi icon={<CalendarDays className="size-4" />} label="Evenementen" value={String(events.length)} />
        <Kpi icon={<Building2 className="size-4" />} label="Leveranciers" value={String(suppliers.length)} />
        <Kpi icon={<Users className="size-4" />} label="Gebruikers" value={String(users.length)} />
        <Kpi icon={<LineChart className="size-4" />} label="Conversieratio" value={`${conversionRate.toFixed(0)}%`} sub="Betaald / aanvragen" />
        <Kpi icon={<LineChart className="size-4" />} label="Gem. eventwaarde" value={formatCurrency(avgEventValue)} />
        <Kpi icon={<Star className="size-4" />} label="Gem. reactietijd" value={`${avgResponseHours.toFixed(0)} uur`} sub="Leveranciers" />
      </div>

      <div className="mt-10">
        <Card>
          <h2 className="mb-4 font-display text-lg text-ink">Abonnementsniveaus</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen leveranciers.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {tierDistribution.map((t) => (
                <div key={t.key} className="rounded-xl border border-line-soft px-3.5 py-2.5 text-center">
                  <p className="font-display text-xl text-ink">{t.count}</p>
                  <p className="text-xs text-ink-faint">{t.label}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Telt het gekozen niveau, ook tijdens de proefperiode (nog geen boekingen afgerond) — dat niveau gaat pas echt gelden zodra
            de proefperiode voorbij is.
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-4 font-display text-lg text-ink">Recente evenementen</h2>
          {events.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen evenementen.</p>
          ) : (
            <div className="space-y-2">
              {/* Alleen de 10 nieuwste tonen — "Recente evenementen" moet niet
                  ongelimiteerd blijven meegroeien met het hele platform. De
                  KPI-tegel "Evenementen" hierboven gebruikt nog gewoon de
                  volledige `events`-lijst, dus die telling blijft correct. */}
              {events.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink">{e.name}</p>
                    <p className="text-xs text-ink-faint">{EVENT_TYPE_LABELS[e.type]} · {e.locationLabel ?? "onbekende locatie"}</p>
                  </div>
                  <StageBadge stage={e.stage} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <p className="mt-8 text-xs text-ink-faint">{offers.length} offertes verwerkt in totaal over alle evenementen.</p>
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
