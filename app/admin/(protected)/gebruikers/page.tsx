import { AdminUserActions } from "@/components/app/AdminUserActions";
import { AdminServiceRoleBanner } from "@/components/app/AdminServiceRoleBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { listAllUsers } from "@/lib/data/store";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Ban } from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Organisator",
  supplier: "Leverancier",
  both: "Organisator + leverancier",
  admin: "Admin",
};

export const metadata = { title: "Gebruikers — Vyra Admin" };

export default async function AdminUsersPage() {
  const users = await listAllUsers();
  const serviceRoleConfigured = isServiceRoleConfigured();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-display text-3xl text-ink">Gebruikers</h1>
      <p className="mt-1 text-ink-soft">Alle organisatoren, leveranciers en admins op het platform.</p>

      {!serviceRoleConfigured && (
        <div className="mt-6">
          <AdminServiceRoleBanner />
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
    </div>
  );
}
