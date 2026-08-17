"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, type LucideIcon } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { LinkButton } from "@/components/ui/Button";
import { SIDEBAR_WIDTH_CLASS } from "@/lib/nav-constants";
import { cn } from "@/lib/utils";

export interface NavShellItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavShellProps {
  items: NavShellItem[];
  /** Volledig logo (met woordmerk) — mobiele strook, drawer-header, volledige zijbalk (`lg`). */
  logo: ReactNode;
  /** Alleen het merkje — icoon-only rail (`md`). */
  logoMark: ReactNode;
  badge?: ReactNode;
  primaryAction?: { href: string; label: string; icon?: ReactNode };
  /** Notificatiebel + avatar, kant-en-klaar meegegeven door de server-parent (die de gebruiker al heeft opgehaald). */
  utility: ReactNode;
  /** Bv. bedrijfsnaam-link + uitlogknop — alleen in de drawer-footer en de volledige (`lg`) zijbalk-footer, niet in de smalle rail. */
  footerExtra?: ReactNode;
}

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Herbruikbare navigatieschil voor de twee ingelogde portals (organisator
 * en leverancier): een hamburgermenu + uitschuifdrawer onder `md` (telefoon,
 * en iPad in smalle split-view), een icoon-only permanente rail op `md`
 * (iPad-portret), en een volledige, met labels, permanente zijbalk vanaf
 * `lg` (iPad-landscape en groter). Alle drie regio's staan in dezelfde
 * component en worden puur met Tailwind-responsive-klassen getoond/verborgen
 * — geen client-side media-query-hook nodig.
 */
export function NavShell({ items, logo, logoMark, badge, primaryAction, utility, footerExtra }: NavShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Drawer sluiten bij navigatie. Bewust GEEN useEffect (dat zou setState
  // synchroon in een effect aanroepen, met cascaderende re-renders tot
  // gevolg) — dit is het door React zelf aanbevolen patroon voor "state
  // aanpassen als een prop wijzigt": setState direct in de render-body,
  // bewaakt door een ref-achtige "vorige waarde"-vergelijking.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  return (
    <>
      {/* ── Mobiele topstrook (< md) ── */}
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-paper/90 px-3 py-2 backdrop-blur-md pt-[calc(var(--safe-t)+0.5rem)] md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu openen"
          aria-expanded={open}
          data-testid="nav-drawer-trigger"
          className="icon-pop flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-paper-dim hover:text-ink"
        >
          <Menu className="size-5" />
        </button>
        {logo}
        <div className="ml-auto flex items-center gap-1">{utility}</div>
      </header>

      {/* ── Drawer (< md) ── */}
      <Drawer open={open} onClose={() => setOpen(false)} side="left" labelledBy="nav-drawer-title" testId="nav-drawer-panel">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div id="nav-drawer-title">{logo}</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menu sluiten"
            className="icon-pop flex size-11 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>
        {badge && <div className="px-5 pt-4">{badge}</div>}
        {primaryAction && (
          <div className="px-5 pt-4">
            <LinkButton href={primaryAction.href} icon={primaryAction.icon} fullWidth variant="secondary">
              {primaryAction.label}
            </LinkButton>
          </div>
        )}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors duration-[var(--duration-swift)]",
                  active ? "bg-paper-dim text-ink" : "text-ink-soft hover:bg-paper-dim hover:text-ink"
                )}
              >
                <Icon className="size-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line-soft px-5 py-4">
          <div className="flex items-center gap-2">{utility}</div>
          {footerExtra && <div className="mt-3">{footerExtra}</div>}
        </div>
      </Drawer>

      {/* ── Permanente zijbalk (>= md): icoon-only rail op md, volledig vanaf lg ── */}
      <aside
        data-testid="app-sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-white pt-[var(--safe-t)] pb-[var(--safe-b)] md:flex",
          SIDEBAR_WIDTH_CLASS
        )}
      >
        <div className="flex items-center justify-center px-3 py-4 lg:justify-start lg:px-5">
          <span className="lg:hidden">{logoMark}</span>
          <span className="hidden lg:block">{logo}</span>
        </div>
        {badge && <div className="hidden px-5 pb-3 lg:block">{badge}</div>}
        {primaryAction && (
          <div className="px-3 pb-4 lg:px-5">
            <LinkButton href={primaryAction.href} variant="secondary" fullWidth className="lg:justify-start" icon={primaryAction.icon}>
              <span className="hidden lg:inline">{primaryAction.label}</span>
            </LinkButton>
          </div>
        )}
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2 lg:px-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-3 rounded-xl px-2 text-sm font-medium transition-colors duration-[var(--duration-swift)] lg:justify-start lg:px-3",
                  active ? "bg-paper-dim text-ink" : "text-ink-soft hover:bg-paper-dim hover:text-ink"
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line-soft px-2 py-3 lg:px-4">
          <div className="flex flex-col items-center gap-2 lg:flex-row lg:justify-start">{utility}</div>
          {footerExtra && <div className="mt-2 hidden lg:block">{footerExtra}</div>}
        </div>
      </aside>
    </>
  );
}
