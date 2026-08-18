import Link from "next/link";
import { Logo, LogoMark } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { NavShell, type NavShellItem } from "@/components/app/NavShell";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getSupplierAccountByOwner } from "@/lib/data/store";
import { Plus, Search, Store, CalendarHeart } from "lucide-react";

export async function AppTopBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [notifications, supplier] = await Promise.all([getNotifications(user.id), getSupplierAccountByOwner(user.id)]);

  const items: NavShellItem[] = [
    { href: "/events", label: "Mijn evenementen", icon: <CalendarHeart className="size-5 shrink-0" /> },
    { href: "/leveranciers", label: "Leveranciers zoeken", icon: <Search className="size-5 shrink-0" /> },
    {
      href: supplier ? "/supplier/dashboard" : "/supplier/onboarding",
      label: supplier ? "Leveranciersportaal" : "Ook leverancier worden?",
      icon: <Store className="size-5 shrink-0" />,
    },
  ];

  return (
    <NavShell
      items={items}
      logo={<Logo />}
      logoMark={<LogoMark />}
      primaryAction={{ href: "/events/new", label: "Nieuw evenement", icon: <Plus className="size-4" /> }}
      utility={(align) => (
        <>
          <NotificationsBell userId={user.id} notifications={notifications} align={align} />
          <Link href="/profile" aria-label="Profiel" className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </Link>
        </>
      )}
    />
  );
}
