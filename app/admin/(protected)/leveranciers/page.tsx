import { AdminSupplierVerificationActions } from "@/components/app/AdminSupplierVerificationActions";
import { AdminRevokeVerificationButton } from "@/components/app/AdminRevokeVerificationButton";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { AdminGeocodeBackfillButton } from "@/components/app/AdminGeocodeBackfillButton";
import { AdminSpotlightBoostRequestActions } from "@/components/app/AdminSpotlightBoostRequestActions";
import { AdminTierUpgradeRequestActions } from "@/components/app/AdminTierUpgradeRequestActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listAllSupplierAccounts, listPendingSpotlightBoostRequests, listPendingTierUpgradeRequests } from "@/lib/data/store";
import { SUBSCRIPTION_TIERS } from "@/lib/config";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isValidKvkFormat, kvkLookupUrl } from "@/lib/utils";
import { ArrowUpCircle, BadgeCheck, Clock, ExternalLink, Star, Zap } from "lucide-react";

export const metadata = { title: "Leveranciers — Vyra Admin" };

export default async function AdminSuppliersPage() {
  const suppliers = await listAllSupplierAccounts();
  const pendingTierUpgradeRequests = await listPendingTierUpgradeRequests();
  const pendingSpotlightBoostRequests = await listPendingSpotlightBoostRequests();
  const serviceRoleConfigured = isServiceRoleConfigured();
  const pendingVerifications = suppliers.filter((s) => !s.verified && s.verificationRequestedAt);
  // "Locatie op een kaart" — leveranciers die zich vóór deze feature
  // registreerden hebben nog geen coördinaten, zie backfillSupplierCoordinatesAction.
  const suppliersWithoutCoords = suppliers.filter((s) => s.lat == null || s.lng == null).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Leveranciers</h1>
      <p className="mt-1 text-ink-soft">Verificatieaanvragen beoordelen en het overzicht van alle leveranciers.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      <div className="mt-6">
        <AdminGeocodeBackfillButton initialRemaining={suppliersWithoutCoords} />
      </div>

      <div className="mt-8">
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
            <div className="space-y-2">
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

      <div className="mt-6">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Upgrade-aanvragen</h2>
            {pendingTierUpgradeRequests.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-ochre-50 px-2.5 py-1 text-xs font-medium text-ochre">
                <Clock className="size-3.5" /> {pendingTierUpgradeRequests.length} in behandeling
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            Leveranciers kunnen zelf een upgrade naar een hoger abonnementsniveau aanvragen — er is nog geen automatische betaalflow,
            dus elke aanvraag wordt hier handmatig beoordeeld. Neem bij goedkeuring buiten Vyra om contact op om de betaling te
            regelen.
          </p>
          {!serviceRoleConfigured ? (
            <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om aanvragen te kunnen goed- of afkeuren.</p>
          ) : pendingTierUpgradeRequests.length === 0 ? (
            <p className="text-sm text-ink-faint">Geen openstaande upgrade-aanvragen.</p>
          ) : (
            <div className="space-y-2">
              {pendingTierUpgradeRequests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{r.companyName}</p>
                      <Badge tone="ochre" icon={<ArrowUpCircle className="size-3.5" />}>
                        {SUBSCRIPTION_TIERS[r.currentTier].label} → {SUBSCRIPTION_TIERS[r.requestedTier as typeof r.currentTier].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-faint">Aangevraagd op {new Date(r.createdAt).toLocaleDateString("nl-NL")}</p>
                    <AdminTierUpgradeRequestActions requestId={r.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Boost-aanvragen</h2>
            {pendingSpotlightBoostRequests.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-ochre-50 px-2.5 py-1 text-xs font-medium text-ochre">
                <Clock className="size-3.5" /> {pendingSpotlightBoostRequests.length} in behandeling
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-ink-faint">
            Losse Spotlight-boosts (zie /supplier/marketing) — ook hier nog geen automatische betaalflow, dus handmatig beoordelen en
            buiten Vyra om afrekenen. Goedkeuren geeft de leverancier meteen +1 spotlight-credit.
          </p>
          {!serviceRoleConfigured ? (
            <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om aanvragen te kunnen goed- of afkeuren.</p>
          ) : pendingSpotlightBoostRequests.length === 0 ? (
            <p className="text-sm text-ink-faint">Geen openstaande boost-aanvragen.</p>
          ) : (
            <div className="space-y-2">
              {pendingSpotlightBoostRequests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{r.companyName}</p>
                      <Badge tone="ochre" icon={<Zap className="size-3.5" />}>Losse boost</Badge>
                    </div>
                    <p className="text-xs text-ink-faint">Aangevraagd op {new Date(r.createdAt).toLocaleDateString("nl-NL")}</p>
                    <AdminSpotlightBoostRequestActions requestId={r.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <h2 className="mb-4 font-display text-lg text-ink">Alle leveranciers</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen geregistreerde leveranciers.</p>
          ) : (
            <div className="space-y-2">
              {[...suppliers]
                // Leveranciers zonder reviews (ratingAvg staat dan op 0) horen
                // niet mee te tellen in de sortering op beoordeling — anders
                // zakken ze onterecht onder leveranciers met een échte lage
                // beoordeling, in plaats van gewoon "nog onbeoordeeld" te zijn.
                .sort((a, b) => {
                  if (a.ratingCount === 0 && b.ratingCount === 0) return 0;
                  if (a.ratingCount === 0) return 1;
                  if (b.ratingCount === 0) return -1;
                  return b.ratingAvg - a.ratingAvg;
                })
                .map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft px-3.5 py-2.5 text-sm">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-ink">{s.companyName}</p>
                        {s.verified && <BadgeCheck className="size-3.5 text-sage" />}
                      </div>
                      <p className="text-xs text-ink-faint">{s.serviceAreas.join(", ")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.ratingCount > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-ink-faint">
                          <Star className="size-3.5 fill-ochre text-ochre" /> {s.ratingAvg.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">Nog geen reviews</span>
                      )}
                      {s.verified && serviceRoleConfigured && <AdminRevokeVerificationButton supplierId={s.id} />}
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
