import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { listAiInteractionLogs } from "@/lib/data/store";
import { Sparkles, ShieldAlert } from "lucide-react";

export const metadata = { title: "Activiteit — Vyra Admin" };

export default async function AdminActivityPage() {
  const aiLogs = await listAiInteractionLogs(50);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Activiteit</h1>
      <p className="mt-1 text-ink-soft">Het AI-interactielogboek van het platform.</p>

      {!aiLogs.serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      <div className="mt-8">
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
            <p className="text-sm text-ink-faint">Vereist de service-role sleutel (zie melding bovenaan) — dit logboek is dan direct zichtbaar, ook met terugwerkende kracht.</p>
          ) : aiLogs.logs.length === 0 ? (
            <p className="text-sm text-ink-faint">Nog geen AI-interacties gelogd.</p>
          ) : (
            <div className="space-y-2">
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
    </div>
  );
}
