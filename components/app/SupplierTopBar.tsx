import Link from "next/link";
import { Logo, LogoMark } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { NotificationsBell } from "@/components/app/NotificationsBell";
import { NavShell, type NavShellItem } from "@/components/app/NavShell";
import { AppNotification, UserAccount, SupplierAccount } from "@/lib/types";
import { logoutAction } from "@/lib/actions/auth-actions";
import { LogOut, LayoutDashboard, Inbox, MessageSquare, ShoppingBag, CalendarDays, CalendarHeart } from "lucide-react";

const ITEMS: NavShellItem[] = [
  { href: "/supplier/dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-5 shrink-0" /> },
  { href: "/supplier/requests", label: "Aanvragen", icon: <Inbox className="size-5 shrink-0" /> },
  { href: "/supplier/messages", label: "Berichten", icon: <MessageSquare className="size-5 shrink-0" /> },
  { href: "/supplier/orders", label: "Orders", icon: <ShoppingBag className="size-5 shrink-0" /> },
  { href: "/supplier/calendar", label: "Kalender", icon: <CalendarDays className="size-5 shrink-0" /> },
  { href: "/events", label: "Mijn evenementen", icon: <CalendarHeart className="size-5 shrink-0" /> },
];

export function SupplierTopBar({ user, supplier, notifications }: { user: UserAccount; supplier: SupplierAccount; notifications: AppNotification[] }) {
  return (
    <NavShell
      items={ITEMS}
      logo={<Logo />}
      logoMark={<LogoMark />}
      badge={<Badge tone="sage">Leveranciersportaal</Badge>}
      utility={
        <>
          <NotificationsBell userId={user.id} notifications={notifications} />
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
      footerExtra={
        <Link href="/supplier/profile" className="nav-link block text-sm text-ink-faint hover:text-ink">
          {supplier.companyName}
        </Link>
      }
    />
  );
}
