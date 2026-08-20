import { AdminSupplierVerificationActions } from "@/components/app/AdminSupplierVerificationActions";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listAllSupplierAccounts } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { isValidKvkFormat, kvkLookupUrl } from "@/lib/utils";
import { BadgeCheck, Clock, ExternalLink, Star } from "lucide-react";

export const metadata = { title: "Leveranciers — Vyra Admin" };

export default async function AdminSuppliersPage() {
  const suppliers = await listAllSupplierAccounts();
  const serviceRoleConfigured = isServiceRoleConfigured();
  const pendingVerifications = suppliers.filter((s) => !s.verified && s.verificationRequestedAt);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Leveranciers</h1>
      <p className="mt-1 text-ink-soft">Verificatieaanvragen beoordelen en het overzicht van alle leveranciers.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

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
          <h2 className="mb-4 font-display text-lg text-ink">Alle leveranciers</h2>
          {suppliers.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen geregistreerde leveranciers.</p>
          ) : (
            <div className="space-y-2">
              {[...suppliers]
                .sort((a, b) => b.ratingAvg - a.ratingAvg)
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
    </div>
  );
}
