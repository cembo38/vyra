import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getSupplierAccountByOwner } from "@/lib/data/store";
import { SupplierTopBar } from "@/components/app/SupplierTopBar";

export default async function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const notifications = await getNotifications(user.id);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SupplierTopBar user={user} supplier={supplier} notifications={notifications} />
      {/* Wrapper (niet de mx-auto/max-w-6xl van <main> zelf) draagt de
          zijbalk-offset — anders zou <main> binnen zijn EIGEN, al versmalde
          box nog eens inspringen i.p.v. als geheel naast de zijbalk te
          schuiven. Zie --nav-sidebar-w in app/globals.css. */}
      <div className="flex-1 transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">
        <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
