import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app/AppTopBar";
import { AdminUserActions } from "@/components/app/AdminUserActions";
import { AdminSupplierVerificationActions } from "@/components/app/AdminSupplierVerificationActions";
import { AdminDisputeActions } from "@/components/app/AdminDisputeActions";
import { AdminBriefingCard } from "@/components/app/AdminBriefingCard";
import { Card } from "@/components/ui/Card";
import { Badge, StageBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getLatestAdminBriefing,
  listAllDisputes,
  listAllEvents,
  listAllOffers,
  listAllPayments,
  listAllRequests,
  listAllSupplierAccounts,
  listAllUsers,
  listAiInteractionLogs,
} from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { formatCurrency, ADMIN_EMAILS } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { DISPUTE_CATEGORY_LABELS, EVENT_TYPE_LABELS, UserRole } from "@/lib/types";
import { SIDEBAR_OFFSET_CLASS } from "@/lib/nav-constants";
import { cn, isValidKvkFormat, kvkLookupUrl } from "@/lib/utils";
import { AlertCircle, AlertTriangle, Ban, BadgeCheck, Building2, CalendarDays, Clock, ExternalLink, LineChart, Percent, ShieldAlert, Sparkles, Star, Users } from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Organisator",
  supplier: "Leverancier",
  both: "Organisator + leverancier",
  admin: "Admin",
};

export const metadata = { title: "Admin — Vyra" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) redirect("/events");

  const [events, payments, requests, offers, users, suppliers, aiLogs, disputes, briefing] = await Promise.all([
    listAllEvents(),
    listAllPayments(),
    listAllRequests(),
    listAllOffers(),
    listAllUsers(),
    listAllSupplierAccounts(),
    listAiInteractionLogs(50),
    listAllDisputes(),
    getLatestAdminBriefing(),
  ]);
  const serviceRoleConfigured = isServiceRoleConfigured();
  const pendingVerifications = suppliers.filter((s) => !s.verified && s.verificationRequestedAt);

  // Namen voor de geschillenlijst hieronder oplossen uit al opgehaalde data
  // (geen extra queries nodig) — spec-item #50.
  const eventById = new Map(events.map((e) => [e.id, e]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const sortedDisputes = [...disputes].sort((a, b) => (a.status === "open" ? -1 : 0) - (b.status === "open" ? -1 : 0));
  const openDisputeCount = disputes.filter((d) => d.status === "open").length;

  const paidPayments = payments.filter((p) => p.status === "paid");
  const gmv = paidPayments.reduce((sum, p) => sum + p.supplierAmountCents, 0);
  const revenue = paidPayments.reduce((sum, p) => sum + p.platformFeeCents, 0);
  // Sinds het gestaffelde commissiemodel (spec-item #53) bestaat er geen
  // enkel vast percentage meer — hier het werkelijke, blended tarief over
  // alle betaalde boekingen, i.p.v. een hardcoded constante die niet meer
  // overal hetzelfde is.
  const blendedCommissionRate = gmv > 0 ? (revenue / gmv) * 100 : 0;
  const proSupplierCount = suppliers.filter((s) => s.proSubscribed).length;
  const eventsWithBudget = events.filter((e) => e.budget);
  const avgEventValue = eventsWithBudget.length ? eventsWithBudget.reduce((s, e) => s + (e.budget?.totalCents ?? 0), 0) / eventsWithBudget.length : 0;
  const avgResponseHours = suppliers.length ? suppliers.reduce((s, sup) => s + sup.avgResponseHours, 0) / suppliers.length : 0;
  const conversionRate = requests.length ? (paidPayments.length / requests.length) * 100 : 0;

  return (
    <div className={cn("min-h-screen bg-paper", SIDEBAR_OFFSET_CLASS)}>
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

        <div className="mt-8">
          <AdminBriefingCard briefing={briefing} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<LineChart className="size-4" />} label="GMV" value={formatCurrency(gmv)} />
          <Kpi icon={<Percent className="size-4" />} label="Platform revenue" value={formatCurrency(revenue)} sub={gmv > 0 ? `${blendedCommissionRate.toFixed(1)}% blended (instap+gestaffeld+Pro)` : "Nog geen betaalde boekingen"} />
          <Kpi icon={<Sparkles className="size-4" />} label="Vyra Pro" value={String(proSupplierCount)} sub={`van ${suppliers.length} leveranciers`} />
          <Kpi icon={<CalendarDays className="size-4" />} label="Evenementen" value={String(events.length)} />
          <Kpi icon={<Building2 className="size-4" />} label="Leveranciers" value={String(suppliers.length)} />
          <Kpi icon={<Users className="size-4" />} label="Gebruikers" value={String(users.length)} />
          <Kpi icon={<LineChart className="size-4" />} label="Conversieratio" value={`${conversionRate.toFixed(0)}%`} sub="Betaald / aanvragen" />
          <Kpi icon={<LineChart className="size-4" />} label="Gem. eventwaarde" value={formatCurrency(avgEventValue)} />
          <Kpi icon={<Star className="size-4" />} label="Gem. reactietijd" value={`${avgResponseHours.toFixed(0)} uur`} sub="Leveranciers" />
        </div>

        <div className="mt-10">
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Gebruikers</h2>
              {users.some((u) => u.bannedAt) && (
                <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger">
                  <Ban className="size-3.5" /> {users.filter((u) => u.bannedAt).length} geblokkeerd
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-ink-faint">
              Blokkeer een account bij misbruik of een geschil — de gebruiker wordt meteen uitgelogd en kan niet meer inloggen totdat je &apos;m deblokkeert.
            </p>
            {!serviceRoleConfigured ? (
              <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om gebruikers te kunnen blokkeren.</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-ink-faint">Nog geen gebruikers.</p>
            ) : (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                {[...users]
                  .sort((a, b) => (a.bannedAt ? -1 : 0) - (b.bannedAt ? -1 : 0))
                  .map((u) => (
                    <div
                      key={u.id}
                      className={cn(
                        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm",
                        u.bannedAt ? "border-danger/30 bg-danger-50/40" : "border-line-soft"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-ink">{u.firstName} {u.lastName}</p>
                          <Badge tone={u.role === "admin" ? "clay" : "neutral"}>{ROLE_LABELS[u.role]}</Badge>
                          {u.bannedAt && <Badge tone="danger">Geblokkeerd</Badge>}
                        </div>
                        <p className="text-xs text-ink-faint">{u.email}</p>
                        {u.bannedAt && u.banReason && <p className="mt-0.5 text-xs text-danger">Reden: {u.banReason}</p>}
                      </div>
                      <AdminUserActions userId={u.id} bannedAt={u.bannedAt} />
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Leveranciersverificatie</h2>
              {pendingVerifications.length > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-ochre-50 px-2.5 py-1 text-xs font-medium text-ochre">
                  <Clock className="size-3.5" /> {pendingVerifications.length} in behandeling
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-ink-faint">
              Leveranciers die verificatie hebben aangevraagd (via hun bedrijfsprofiel, na het invullen van een KVK-nummer). Controleer het KVK-nummer en de bedrijfsgegevens voordat je goedkeurt — het rode label hieronder is alleen een formaat-check (8 cijfers), géén koppeling met het echte handelsregister, dus gebruik de KVK-link om zelf te controleren of de gegevens kloppen.
            </p>
            {!serviceRoleConfigured ? (
              <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om verificaties te kunnen goed- of afkeuren.</p>
            ) : pendingVerifications.length === 0 ? (
              <p className="text-sm text-ink-faint">Geen openstaande verificatieaanvragen.</p>
            ) : (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                {pendingVerifications.map((s) => {
                  const kvkFormatOk = isValidKvkFormat(s.kvkNumber);
                  return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{s.companyName}</p>
                        <Badge tone="ochre" icon={<Clock className="size-3.5" />}>Aangevraagd</Badge>
                        {!kvkFormatOk && <Badge tone="danger">Ongeldig KVK-formaat</Badge>}
                      </div>
                      <p className="text-xs text-ink-faint">
                        KVK: {s.kvkNumber ?? "onbekend"} · {s.contactPerson} · {s.baseLocation}
                        {s.kvkNumber && (
                          <>
                            {" · "}
                            <a
                              href={kvkLookupUrl(s.kvkNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 font-medium text-sage hover:underline"
                            >
                              Controleer bij KVK <ExternalLink className="size-3" />
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <AdminSupplierVerificationActions supplierId={s.id} />
                  </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
            {suppliers.length === 0 ? (
              <p className="text-sm text-ink-faint">Nog geen geregistreerde leveranciers.</p>
            ) : (
            <div className="space-y-2">
              {[...suppliers]
                .sort((a, b) => b.ratingAvg - a.ratingAvg)
                .slice(0, 6)
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-ink">{s.companyName}</p>
                        {s.verified && <BadgeCheck className="size-3.5 text-sage" />}
                      </div>
                      <p className="text-xs text-ink-faint">{s.serviceAreas.join(", ")}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-ink-faint">
                      <Star className="size-3.5 fill-ochre text-ochre" /> {s.ratingAvg.toFixed(1)}
                    </span>
                  </div>
                ))}
            </div>
            )}
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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

          <Card id="geschillen">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Geschillen</h2>
              {openDisputeCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger">
                  <AlertCircle className="size-3.5" /> {openDisputeCount} in behandeling
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-ink-faint">Gemelde problemen tussen organisatoren en leveranciers over een specifieke boeking.</p>
            {!serviceRoleConfigured ? (
              <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om geschillen platformbreed te zien en af te handelen.</p>
            ) : sortedDisputes.length === 0 ? (
              <EmptyState icon={<AlertCircle className="size-6" />} title="Geen openstaande geschillen" description="Gemelde problemen tussen organisatoren en leveranciers verschijnen hier." />
            ) : (
              <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                {sortedDisputes.map((d) => {
                  const event = eventById.get(d.eventId);
                  const supplier = supplierById.get(d.supplierId);
                  const filer = userById.get(d.filedBy);
                  return (
                    <div
                      key={d.id}
                      className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-sm",
                        d.status === "open" ? "border-danger/30 bg-danger-50/40" : "border-line-soft"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-ink">{event?.name ?? "Onbekend evenement"} · {supplier?.companyName ?? "Onbekende leverancier"}</p>
                        <Badge tone={d.status === "open" ? "danger" : d.status === "resolved" ? "success" : "neutral"}>
                          {d.status === "open" ? "In behandeling" : d.status === "resolved" ? "Opgelost" : "Afgewezen"}
                        </Badge>
                        <Badge tone="neutral">{DISPUTE_CATEGORY_LABELS[d.category]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-faint">
                        Gemeld door {filer ? `${filer.firstName} ${filer.lastName}` : "onbekende gebruiker"} ({d.filedByRole === "customer" ? "organisator" : "leverancier"}) op {new Date(d.createdAt).toLocaleDateString("nl-NL")}
                      </p>
                      <p className="mt-1.5 text-sm text-ink-soft">{d.description}</p>
                      {d.adminResponse && (
                        <p className="mt-1.5 rounded-lg bg-paper-dim px-2.5 py-1.5 text-xs text-ink-soft">
                          <span className="font-medium text-ink">Reactie:</span> {d.adminResponse}
                        </p>
                      )}
                      {d.status === "open" && <AdminDisputeActions disputeId={d.id} />}
                    </div>
                  );
                })}
              </div>
            )}
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
