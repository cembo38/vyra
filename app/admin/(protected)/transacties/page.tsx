import { Card } from "@/components/ui/Card";
import { listAllPayments } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/config";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";

export const metadata = { title: "Transacties — Vyra Admin" };

export default async function AdminPaymentsPage() {
  const payments = await listAllPayments();
  const serviceRoleConfigured = isServiceRoleConfigured();
  const paidCount = payments.filter((p) => p.status === "paid").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Transacties</h1>
      <p className="mt-1 text-ink-soft">Alle bevestigde boekingen — aanbetalingen, restbedragen en volledige boekingen.</p>
      {/*
        Zolang er geen betaaldienst is aangesloten, verwerkt Vyra dit geld
        niet zelf: dit is een overzicht van bevestigde boekingen en de
        commissie die daarover zou gelden, geen transactielog van
        daadwerkelijk ontvangen geld. Zie confirmPaymentAction in
        lib/actions/marketplace-actions.ts voor de volledige toelichting.
      */}
      <p className="mt-1 text-xs text-ink-faint">Vyra verwerkt op dit moment nog geen betalingen zelf — organisatoren rekenen rechtstreeks met leveranciers af. &quot;Bevestigd&quot; = organisator heeft de boeking bevestigd, geen geldstroom via Vyra.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      <div className="mt-8">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Alle transacties</h2>
            <span className="text-xs text-ink-faint">{paidCount} bevestigd van {payments.length}</span>
          </div>
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
                    <p className="text-xs text-ink-faint">Fee (nog niet geïnd): {formatCurrency(p.platformFeeCents)}</p>
                  </div>
                  <span className={`text-xs font-medium ${p.status === "paid" ? "text-success" : "text-ochre"}`}>{p.status === "paid" ? "Bevestigd" : "Nog niet bevestigd"}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
