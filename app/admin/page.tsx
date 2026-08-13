import { ReactNode } from "react";
import { redirect } from "next/navigation";
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
  listAiInteractionLogs,
} from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { formatCurrency, PLATFORM_COMMISSION_RATE, ADMIN_EMAILS } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { AlertCircle, AlertTriangle, Building2, CalendarDays, LineChart, Percent, ShieldAlert, Sparkles, Star, Users } from "lucide-react";

export const metadata = { title: "Admin — Vyra" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) redirect("/events");

  const [events, payments, requests, offers, users, aiLogs] = await Promise.all([
    listAllEvents(),
    listAllPayments(),
    listAllRequests(),
    listAllOffers(),
    listAllUsers(),
    listAiInteractionLogs(50),
  ]);
  const suppliers = allSuppliers();
  const serviceRoleConfigured = isServiceRoleConfigured();

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

        {!serviceRoleConfigured && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-ochre-50 px-4 py-3 text-sm text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ochre" />
            <div>
              <p className="font-medium">Platformbrede weergave nog niet actief</p>
              <p className="mt-0.5 text-ink-soft">
                Zonder <code className="rounded bg-white/60 px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in <code className="rounded bg-white/60 px-1 py-0.5 text-xs">.env.local</code> zie
                je hieronder alleen jouw eigen data, en is het AI-logboek leeg. Te vinden via Supabase → Settings → API → &quot;service_role&quot;.
              </p>
            </div>
          </div>
        )}

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
                      <Star className="size-3.5 fill-ochre text-ochre" /> {s.ratingAvg.toFixed(1)}
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
                      <p className="font-medium text-ink">
                        {formatCurrency(p.totalCents)}
                        {p.installment !== "full" && (
                          <span className="ml-1.5 text-xs font-normal text-ink-faint">({p.installment === "deposit" ? "aanbetaling" : "restbedrag"})</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-faint">Fee: {formatCurrency(p.platformFeeCents)}</p>
                    </div>
                    <span className={`text-xs font-medium ${p.status === "paid" ? "text-success" : "text-ochre"}`}>{p.status === "paid" ? "Betaald" : "In behandeling"}</span>
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

        <div className="mt-6">
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg text-ink">
                <Sparkles className="size-4.5 text-sage" /> AI-interactielogboek
              </h2>
              {aiLogs.logs.some((l) => l.flagged) && (
                <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger">
                  <ShieldAlert className="size-3.5" /> {aiLogs.logs.filter((l) => l.flagged).length} gemarkeerd
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-ink-faint">
              Elke AI-aanroep wordt hier gelogd — inclusief interacties die zijn gemarkeerd als mogelijke prompt-injection-poging. Zo kun je meelezen als er iets misgaat.
            </p>
            {!aiLogs.serviceRoleConfigured ? (
              <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding hierboven) — dit logboek is dan direct zichtbaar, ook met terugwerkende kracht.</p>
            ) : aiLogs.logs.length === 0 ? (
              <p className="text-sm text-ink-faint">Nog geen AI-interacties gelogd.</p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto">
                {aiLogs.logs.map((log) => (
                  <div
                    key={log.id}
                    className={`rounded-xl border px-3.5 py-2.5 text-sm ${log.flagged ? "border-danger/40 bg-danger-50/50" : "border-line-soft"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-ink">{log.role}</span>
                      <div className="flex items-center gap-1.5">
                        {log.flagged && (
                          <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger">
                            <ShieldAlert className="size-3" /> gemarkeerd
                          </span>
                        )}
                        <span className={`text-xs font-medium ${log.succeeded ? "text-success" : "text-ink-faint"}`}>{log.succeeded ? "gelukt" : "mislukt"}</span>
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{log.input}</p>
                    <p className="mt-1 text-xs text-ink-faint">{new Date(log.createdAt).toLocaleString("nl-NL")}</p>
                  </div>
                ))}
              </div>
            )}
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
