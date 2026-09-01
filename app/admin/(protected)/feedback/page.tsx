import { AdminFeedbackActions } from "@/components/app/AdminFeedbackActions";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listAllFeedbackReports } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { Bug, CircleHelp, LifeBuoy } from "lucide-react";

export const metadata = { title: "Feedback — Vyra Admin" };

export default async function AdminFeedbackPage() {
  const reports = await listAllFeedbackReports();
  const serviceRoleConfigured = isServiceRoleConfigured();

  const sorted = [...reports].sort((a, b) => (a.status === "open" ? -1 : 0) - (b.status === "open" ? -1 : 0));
  const openCount = reports.filter((r) => r.status === "open").length;
  const bugCount = reports.filter((r) => r.status === "open" && r.type === "bug").length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Feedback</h1>
      <p className="mt-1 text-ink-soft">Vragen en bugmeldingen die bezoekers via de hulp-knop op elke pagina achterlaten.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      <div className="mt-8">
        <Card>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg text-ink">Alle meldingen</h2>
            <div className="flex items-center gap-1.5">
              {bugCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger">
                  <Bug className="size-3.5" /> {bugCount} bug{bugCount === 1 ? "" : "s"}
                </span>
              )}
              {openCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning">
                  {openCount} openstaand
                </span>
              )}
            </div>
          </div>
          {!serviceRoleConfigured ? (
            <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) om alle meldingen platformbreed te zien en af te handelen.</p>
          ) : sorted.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="size-6" />} title="Nog geen meldingen" description="Vragen en bugmeldingen via de hulp-knop verschijnen hier." />
          ) : (
            <div className="space-y-2">
              {sorted.map((r) => (
                <div key={r.id} className={cn("rounded-xl border px-3.5 py-2.5 text-sm", r.status === "open" ? (r.type === "bug" ? "border-danger/30 bg-danger-50/40" : "border-warning/30 bg-warning-50/40") : "border-line-soft")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={r.type === "bug" ? "danger" : "sage"} icon={r.type === "bug" ? <Bug className="size-3" /> : <CircleHelp className="size-3" />}>
                      {r.type === "bug" ? "Werkt niet" : "Vraag"}
                    </Badge>
                    <Badge tone={r.status === "open" ? "warning" : "success"}>{r.status === "open" ? "Openstaand" : "Afgehandeld"}</Badge>
                    {r.pagePath && <span className="text-xs text-ink-faint">{r.pagePath}</span>}
                  </div>
                  <p className="mt-1.5 text-sm text-ink">{r.message}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {r.email ? r.email : "Geen e-mail opgegeven"} · {new Date(r.createdAt).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {r.adminNote && (
                    <p className="mt-1.5 rounded-lg bg-paper-dim px-2.5 py-1.5 text-xs text-ink-soft">
                      <span className="font-medium text-ink">Notitie:</span> {r.adminNote}
                    </p>
                  )}
                  <AdminFeedbackActions reportId={r.id} isOpen={r.status === "open"} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
