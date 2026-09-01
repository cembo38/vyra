"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Users, Building2, AlertCircle, CreditCard, Sparkles, Settings, LogOut, ShieldCheck, LifeBuoy } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { adminLogoutAction } from "@/lib/actions/admin-auth-actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/utils";

const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Overzicht", icon: <LayoutDashboard className="size-5 shrink-0" /> },
  { href: "/admin/gebruikers", label: "Gebruikers", icon: <Users className="size-5 shrink-0" /> },
  { href: "/admin/leveranciers", label: "Leveranciers", icon: <Building2 className="size-5 shrink-0" /> },
  { href: "/admin/geschillen", label: "Geschillen", icon: <AlertCircle className="size-5 shrink-0" /> },
  { href: "/admin/feedback", label: "Feedback", icon: <LifeBuoy className="size-5 shrink-0" /> },
  { href: "/admin/transacties", label: "Transacties", icon: <CreditCard className="size-5 shrink-0" /> },
  { href: "/admin/activiteit", label: "Activiteit", icon: <Sparkles className="size-5 shrink-0" /> },
  { href: "/admin/instellingen", label: "Instellingen", icon: <Settings className="size-5 shrink-0" /> },
] as const;

function isActive(href: string, pathname: string) {
  // "/admin" moet alleen op de Overzicht-pagina zelf actief zijn — anders
  // zou het altijd "actief" lijken op elke andere /admin/*-subpagina, want
  // die beginnen allemaal met dezelfde prefix.
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Losse, donkere navigatieschil voor de admin-omgeving (spec-item #52
 * vervolg: "ik wil echt een aparte admin omgeving"). Bewust GEEN hergebruik
 * van `NavShell` (de schil achter `AppTopBar`/`SupplierTopBar`): die is
 * structureel op het lichte `--color-paper`-thema gebouwd (badge/primaire
 * actie/notificatiebel-slots die hier niet van toepassing zijn) en zou meer
 * moeite kosten te "verdonkeren" dan een kleine, eigen variant te bouwen.
 * Zelfde onderliggende patroon (mobiele topstrook + drawer onder `md`,
 * icoon-only rail op `md`, volledige zijbalk vanaf `lg`) voor consistente
 * responsiveness met de rest van de app.
 */
export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Drawer sluiten bij navigatie — zelfde bewuste "setState tijdens render
  // i.p.v. useEffect"-patroon als NavShell (zie de toelichting daar).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  const logoBlock = (
    <div className="flex items-center gap-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-paper/10 text-paper">
        <ShieldCheck className="size-4" />
      </div>
      <span className="font-display text-base text-paper">Vyra Admin</span>
    </div>
  );

  const logoutButton = (
    <form action={adminLogoutAction}>
      <SubmitButton
        iconOnly
        title="Uitloggen"
        aria-label="Uitloggen"
        className="chip-hover flex min-h-11 w-full items-center justify-center gap-3 rounded-xl px-2 text-sm font-medium text-paper/60 transition-colors hover:bg-paper/5 hover:text-paper lg:justify-start lg:px-3"
      >
        <LogOut className="size-5 shrink-0" />
        <span className="hidden lg:inline">Uitloggen</span>
      </SubmitButton>
    </form>
  );

  return (
    <div className="min-h-dvh bg-paper">
      {/* ── Mobiele topstrook (< md) ── */}
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-paper/10 bg-ink px-3 py-2 pt-[calc(var(--safe-t)+0.5rem)] md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu openen"
          aria-expanded={open}
          className="icon-pop flex size-11 shrink-0 items-center justify-center rounded-full text-paper/70 hover:bg-paper/10 hover:text-paper"
        >
          <Menu className="size-5" />
        </button>
        {logoBlock}
      </header>

      {/* ── Drawer (< md) ── */}
      <Drawer open={open} onClose={() => setOpen(false)} side="left" labelledBy="admin-drawer-title" panelClassName="bg-ink">
        <div className="flex items-center justify-between border-b border-paper/10 px-5 py-4">
          <div id="admin-drawer-title">{logoBlock}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menu sluiten"
            className="icon-pop flex size-11 items-center justify-center rounded-full text-paper/50 hover:bg-paper/10 hover:text-paper"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-[var(--duration-swift)]",
                  active ? "bg-paper/10 text-paper" : "text-paper/60 hover:bg-paper/5 hover:text-paper"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-paper/10 px-3 py-4">
          <p className="truncate px-3 pb-2 text-xs text-paper/40">{email}</p>
          {logoutButton}
        </div>
      </Drawer>

      {/* ── Permanente zijbalk (>= md): icoon-only rail op md, volledig vanaf lg ── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col border-r border-paper/10 bg-ink pt-[var(--safe-t)] pb-[var(--safe-b)] md:flex lg:w-64">
        <div className="flex items-center justify-center px-3 py-4 lg:justify-start lg:px-5">
          <span className="lg:hidden">
            <ShieldCheck className="size-5 text-paper" />
          </span>
          <span className="hidden lg:block">{logoBlock}</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2 lg:px-3">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-3 rounded-xl px-2 text-sm font-medium transition-colors duration-[var(--duration-swift)] lg:justify-start lg:px-3",
                  active ? "bg-paper/10 text-paper" : "text-paper/60 hover:bg-paper/5 hover:text-paper"
                )}
              >
                {item.icon}
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-paper/10 px-2 py-3 lg:px-4">
          <p className="hidden truncate px-1 pb-2 text-xs text-paper/40 lg:block">{email}</p>
          {logoutButton}
        </div>
      </aside>

      <div className="md:pl-[76px] lg:pl-64">{children}</div>
    </div>
  );
}
