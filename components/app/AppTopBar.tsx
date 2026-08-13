import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getSupplierAccountByOwner } from "@/lib/data/store";
import { Plus, Search, Store } from "lucide-react";

export async function AppTopBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [notifications, supplier] = await Promise.all([getNotifications(user.id), getSupplierAccountByOwner(user.id)]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft sm:flex">
            <Link href="/events" className="hover:text-ink">Mijn evenementen</Link>
            <Link href="/leveranciers" className="inline-flex items-center gap-1.5 hover:text-ink">
              <Search className="size-3.5" /> Leveranciers zoeken
            </Link>
            <Link href={supplier ? "/supplier/dashboard" : "/supplier/onboarding"} className="inline-flex items-center gap-1.5 hover:text-ink">
              <Store className="size-3.5" /> {supplier ? "Leveranciersportaal" : "Ook leverancier worden?"}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/events/new" size="sm" variant="secondary" icon={<Plus className="size-4" />} className="hidden sm:inline-flex">
            Nieuw evenement
          </LinkButton>
          <NotificationsBell userId={user.id} notifications={notifications} />
          <Link href="/profile" aria-label="Profiel">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </Link>
        </div>
      </div>
    </header>
  );
}
