import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getSupplierAccountByOwner } from "@/lib/data/store";
import { SupplierTopBar } from "@/components/app/SupplierTopBar";
import { SIDEBAR_OFFSET_CLASS } from "@/lib/nav-constants";
import { cn } from "@/lib/utils";

export default async function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const notifications = await getNotifications(user.id);

  return (
    <div className={cn("flex min-h-screen flex-col bg-paper", SIDEBAR_OFFSET_CLASS)}>
      <SupplierTopBar user={user} supplier={supplier} notifications={notifications} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
