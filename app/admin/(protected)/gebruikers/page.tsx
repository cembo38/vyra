import { AdminAccountDeletionRequestActions } from "@/components/app/AdminAccountDeletionRequestActions";
import { AdminUserActions } from "@/components/app/AdminUserActions";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listAllUsers, listPendingAccountDeletionRequests } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { USER_ROLE_LABELS } from "@/lib/types";
import { formatDateNL } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Ban, Trash2 } from "lucide-react";

export const metadata = { title: "Gebruikers — Vyra Admin" };

export default async function AdminUsersPage() {
  const serviceRoleConfigured = isServiceRoleConfigured();
  const [users, deletionRequests] = await Promise.all([
    listAllUsers(),
    serviceRoleConfigured ? listPendingAccountDeletionRequests() : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Gebruikers</h1>
      <p className="mt-1 text-ink-soft">Alle organisatoren, leveranciers en admins op het platform.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
        </div>
      )}

      {deletionRequests.length > 0 && (
        <div className="mt-8">
          <Card>
            <div className="mb-1 flex items-center gap-2">
              <Trash2 className="size-4.5 text-danger" />
              <h2 className="font-display text-lg text-ink">Verwijderingsverzoeken</h2>
              <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger">{deletionRequests.length}</span>
            </div>
            <p className="mb-4 text-xs text-ink-faint">
              Zelfbedienings AVG-verzoeken (via &quot;Privacy &amp; gegevens&quot; op /profile of /supplier/profile). &quot;Goedkeuren&quot; bevestigt het verzoek — de daadwerkelijke, onomkeerbare verwijdering doe je daarna zelf in het Supabase-dashboard.
            </p>
            <div className="space-y-3">
              {deletionRequests.map((r) => (
                <div key={r.id} className="rounded-xl border border-line-soft px-3.5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ink">{r.email}</p>
                    <span className="text-xs text-ink-faint">Aangevraagd {formatDateNL(r.createdAt)}</span>
                  </div>
                  {r.reason && <p className="mt-1 text-xs text-ink-soft">Reden: {r.reason}</p>}
                  <AdminAccountDeletionRequestActions requestId={r.id} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="mt-8">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Alle gebruikers</h2>
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
            <div className="space-y-2">
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
                        <Badge tone={u.role === "admin" ? "clay" : "neutral"}>{USER_ROLE_LABELS[u.role]}</Badge>
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
    </div>
  );
}
