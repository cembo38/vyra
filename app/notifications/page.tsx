import { redirect } from "next/navigation";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { NotificationsList } from "@/components/app/NotificationsList";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/data/store";

export const metadata = { title: "Notificaties — Vyra" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id);

  return (
    <div className="min-h-screen bg-paper">
      <AppTopBar />
      {/* md:pl-[var(--nav-sidebar-w)]: ruimte voor de permanente zijbalk, zie app/globals.css. */}
      <div className="transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">
      <div className="mx-auto max-w-lg px-6 py-10">
        <h1 className="font-display text-3xl text-ink">Notificaties</h1>
        <p className="mt-1 text-ink-soft">Alles wat er is gebeurd rond je evenementen en aanvragen.</p>

        <Card className="mt-6">
          <NotificationsList userId={user.id} notifications={notifications} />
        </Card>
      </div>
      </div>
    </div>
  );
}
