import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { NotificationsList } from "@/components/app/NotificationsList";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/data/store";

export const metadata = { title: "Notificaties — Vyra voor leveranciers" };

export default async function SupplierNotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await getNotifications(user.id);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl text-ink">Notificaties</h1>
      <p className="mt-1 text-ink-soft">Alles wat er is gebeurd rond je aanvragen, berichten en verificatie.</p>

      <Card className="mt-6">
        <NotificationsList userId={user.id} notifications={notifications} />
      </Card>
    </div>
  );
}
