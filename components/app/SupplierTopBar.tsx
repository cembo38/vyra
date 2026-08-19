import { Logo, LogoMark } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { NavShell, type NavShellItem } from "@/components/app/NavShell";
import { AppNotification, UserAccount, SupplierAccount } from "@/lib/types";
import { logoutAction } from "@/lib/actions/auth-actions";
import { LogOut, LayoutDashboard, Inbox, MessageSquare, ShoppingBag, CalendarDays, CalendarHeart, User, Bell } from "lucide-react";

const ITEMS: NavShellItem[] = [
  { href: "/supplier/dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-5 shrink-0" /> },
  // Het belletje rechtsboven/onderin opende een uitklappaneel dat door een
  // positioneringsbug (deels) buiten beeld viel — zie NotificationsBell.tsx.
  // Ook los daarvan is een volwaardige pagina prettiger om oudere
  // notificaties in terug te vinden dan het korte paneel.
  { href: "/supplier/notifications", label: "Notificaties", icon: <Bell className="size-5 shrink-0" /> },
  { href: "/supplier/requests", label: "Aanvragen", icon: <Inbox className="size-5 shrink-0" /> },
  { href: "/supplier/messages", label: "Berichten", icon: <MessageSquare className="size-5 shrink-0" /> },
  { href: "/supplier/orders", label: "Orders", icon: <ShoppingBag className="size-5 shrink-0" /> },
  { href: "/supplier/calendar", label: "Kalender", icon: <CalendarDays className="size-5 shrink-0" /> },
  // Stond voorheen alleen als klein tekstlinkje (bedrijfsnaam) onderaan de
  // footer — makkelijk over het hoofd te zien. Nu ook als volwaardig
  // navigatie-item, net als de rest.
  { href: "/supplier/profile", label: "Bedrijfsprofiel", icon: <User className="size-5 shrink-0" /> },
  { href: "/events", label: "Mijn evenementen", icon: <CalendarHeart className="size-5 shrink-0" /> },
];

// `supplier` wordt hier niet meer gebruikt (zie hieronder), maar blijft in
// de props zodat de aanroep vanuit de layout ongewijzigd kan blijven.
export function SupplierTopBar({ user, notifications }: { user: UserAccount; supplier: SupplierAccount; notifications: AppNotification[] }) {
  return (
    <NavShell
      items={ITEMS}
      logo={<Logo />}
      logoMark={<LogoMark />}
      badge={<Badge tone="sage">Leveranciersportaal</Badge>}
      utilityRight={
        <>
          <NotificationsBell userId={user.id} notifications={notifications} align="right" viewAllHref="/supplier/notifications" />
          <span className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Uitloggen" className="icon-pop flex size-11 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </>
      }
      utilityLeft={
        <>
          <NotificationsBell userId={user.id} notifications={notifications} align="left" direction="up" viewAllHref="/supplier/notifications" />
          <span className="icon-pop inline-block rounded-full">
            <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} />
          </span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Uitloggen" className="icon-pop flex size-11 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </>
      }
    />
  );
}
