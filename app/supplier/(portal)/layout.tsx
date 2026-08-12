import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner } from "@/lib/data/store";
import { SupplierTopBar } from "@/components/app/SupplierTopBar";

export default async function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <SupplierTopBar user={user} supplier={supplier} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
