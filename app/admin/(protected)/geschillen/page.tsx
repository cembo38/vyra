import { AdminDisputeActions } from "@/components/app/AdminDisputeActions";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listAllDisputes, listAllEvents, listAllSupplierAccounts, listAllUsers } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { DISPUTE_CATEGORY_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Geschillen — Vyra Admin" };

export default async function AdminDisputesPage() {
  const [disputes, events, suppliers, users] = await Promise.all([listAllDisputes(), listAllEvents(), listAllSupplierAccounts(), listAllUsers()]);
  const serviceRoleConfigured = isServiceRoleConfigured();

  // Namen voor de geschillenlijst oplossen uit al opgehaalde data (geen
  // extra queries nodig) — spec-item #50.
  const eventById = new Map(events.map((e) => [e.id, e]));
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const sortedDisputes = [...disputes].sort((a, b) => (a.status === "open" ? -1 : 0) - (b.status === "open" ? -1 : 0));
  const openDisputeCount = disputes.filter((d) => d.status === "open").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Geschillen</h1>
      <p className="mt-1 text-ink-soft">Gemelde problemen tussen organisatoren en leveranciers over een specifieke boeking.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      <div className="mt-8">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Alle geschillen</h2>
            {openDisputeCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger">
                <AlertCircle className="size-3.5" /> {openDisputeCount} in behandeling
              </span>
            )}
          </div>
          {!serviceRoleConfigured ? (
            <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om geschillen platformbreed te zien en af te handelen.</p>
          ) : sortedDisputes.length === 0 ? (
            <EmptyState icon={<AlertCircle className="size-6" />} title="Geen openstaande geschillen" description="Gemelde problemen tussen organisatoren en leveranciers verschijnen hier." />
          ) : (
            <div className="space-y-2">
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
    </div>
  );
}
