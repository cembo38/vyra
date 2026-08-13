import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { UserAvatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { UserAccount, SupplierAccount } from "@/lib/types";
import { logoutAction } from "@/lib/actions/auth-actions";
import { LogOut, CalendarHeart } from "lucide-react";

export function SupplierTopBar({ user, supplier }: { user: UserAccount; supplier: SupplierAccount }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Logo />
          <Badge tone="sage">Leveranciersportaal</Badge>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft sm:flex">
            <Link href="/supplier/dashboard" className="nav-link hover:text-ink">Dashboard</Link>
            <Link href="/supplier/requests" className="nav-link hover:text-ink">Aanvragen</Link>
            <Link href="/supplier/orders" className="nav-link hover:text-ink">Orders</Link>
            <Link href="/supplier/calendar" className="nav-link hover:text-ink">Kalender</Link>
            <Link href="/events" className="nav-link inline-flex items-center gap-1.5 hover:text-ink">
              <CalendarHeart className="size-3.5" /> Mijn evenementen
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/supplier/profile" className="nav-link hidden text-sm text-ink-faint hover:text-ink sm:inline">{supplier.companyName}</Link>
          <span className="icon-pop inline-block rounded-full"><UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} /></span>
          <form action={logoutAction}>
            <button type="submit" aria-label="Uitloggen" className="icon-pop rounded-full p-2 text-ink-faint hover:bg-paper-dim hover:text-ink">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
