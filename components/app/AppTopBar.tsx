import Link from "next/link";
import { Logo, LogoMark } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { NavShell, type NavShellItem } from "@/components/app/NavShell";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications, getSupplierAccountByOwner } from "@/lib/data/store";
import { Plus, Search, Store, CalendarHeart, Bell, Heart } from "lucide-react";

export async function AppTopBar() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [notifications, supplier] = await Promise.all([getNotifications(user.id), getSupplierAccountByOwner(user.id)]);

  const items: NavShellItem[] = [
    { href: "/events", label: "Mijn evenementen", icon: <CalendarHeart className="size-5 shrink-0" /> },
    { href: "/leveranciers", label: "Leveranciers zoeken", icon: <Search className="size-5 shrink-0" /> },
    { href: "/mijn-leveranciers", label: "Mijn leveranciers", icon: <Heart className="size-5 shrink-0" /> },
    {
      href: supplier ? "/supplier/dashboard" : "/supplier/onboarding",
      label: supplier ? "Leveranciersportaal" : "Ook leverancier worden?",
      icon: <Store className="size-5 shrink-0" />,
    },
    // Het belletje opende een uitklappaneel dat door een positioneringsbug
    // (deels) buiten beeld viel — zie NotificationsBell.tsx. Ook los daarvan
    // is een volwaardige pagina prettiger om oudere notificaties in terug te
    // vinden dan het korte paneel.
    { href: "/notifications", label: "Notificaties", icon: <Bell className="size-5 shrink-0" /> },
  ];

  return (
    <NavShell
      items={items}
      logo={<Logo />}
      logoMark={<LogoMark />}
      primaryAction={{ href: "/events/new", label: "Nieuw evenement", icon: <Plus className="size-4" /> }}
      utilityRight={
        <>
          <NotificationsBell userId={user.id} notifications={notifications} align="right" viewAllHref="/notifications" />
          <Link href="/profile" aria-label="Profiel" className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </Link>
        </>
      }
      utilityLeft={
        <>
          {/* direction="up": deze knop zit onderaan de drawer-/zijbalk-footer
              — het paneel moet dus omhoog openklappen, anders valt het
              (deels) buiten de viewport. Zie de toelichting bij `direction`
              in NotificationsBell.tsx. */}
          <NotificationsBell userId={user.id} notifications={notifications} align="left" direction="up" viewAllHref="/notifications" />
          <Link href="/profile" aria-label="Profiel" className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </Link>
        </>
      }
    />
  );
}
