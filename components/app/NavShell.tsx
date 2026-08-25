"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronLeft, Search } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { LinkButton } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface NavShellItem {
  href: string;
  label: string;
  /**
   * Al-gerenderd icoon-element (bv. `<CalendarHeart className="size-5
   * shrink-0" />`), GEEN los componenttype. NavShell is een Client
   * Component; een niet-aangeroepen componentverwijzing (zoals het
   * componenttype zelf) is een functie en functies kunnen niet van een
   * Server Component naar een Client Component worden doorgegeven — dat
   * crasht de pagina met "Functions cannot be passed directly to Client
   * Components". Een reeds gerenderd element (het resultaat van `<Icon />`)
   * is wél gewoon serialiseerbare React-inhoud.
   */
  icon: ReactNode;
}

/**
 * Klein, apart wisselknopje tussen de organisator- en leveranciersweergave
 * — zie de toelichting bij `roleSwitch` hieronder voor de aanleiding.
 */
export interface NavShellRoleSwitch {
  active: "organizer" | "supplier";
  organizerHref: string;
  supplierHref: string;
}

interface NavShellProps {
  items: NavShellItem[];
  /** Logo (met woordmerk) — alleen nog gebruikt in de mobiele topstrook/drawer (< md); de permanente zijbalk (>= md) rendert haar eigen, in-/uitklapbare logoblok, zie de toelichting bij `.nav-label` hieronder. */
  logo: ReactNode;
  /** Kleine, uppercase sectielabel boven de navigatielijst in de zijbalk (bv. "Ontdek leveranciers" of "Leveranciersportaal") — was voorheen de titel op de dropdown-knop, nu een groepslabel zoals bij Etsy's Shop Manager. */
  menuLabel: string;
  /**
   * Klein segmented-knopje ("Organisator"/"Leverancier") bovenin de zijbalk,
   * alleen meegeven als iemand ECHT beide rollen heeft (dus een bestaand
   * leveranciersprofiel) — zie AppTopBar/SupplierTopBar voor de precieze
   * voorwaarde per kant.
   */
  roleSwitch?: NavShellRoleSwitch;
  /**
   * Visueel afwijkend (groen, met scheidingslijn erboven) item onderaan de
   * navigatielijst — voor een actie die niet bij de gewone navigatie hoort
   * maar ook geen los kruispunt is, zoals "Ook leverancier worden?" voor wie
   * nog geen leveranciersprofiel heeft (en dus geen `roleSwitch` krijgt,
   * want er is nog niets om naar te wisselen).
   */
  secondaryAction?: { href: string; label: string; icon: ReactNode };
  primaryAction?: { href: string; label: string; icon?: ReactNode };
  /**
   * Optioneel zoekveld bovenin de zijbalk — alleen meegeven als er ergens
   * écht een pagina is die de `name`-queryparameter oppikt (bv.
   * `/leveranciers?q=...`, zie `app/leveranciers/page.tsx`).
   */
  search?: { action: string; name: string; placeholder: string };
  /**
   * Notificatiebel + avatar (+ eventueel uitlogknop) voor de MOBIELE
   * topstrook (< md) — kant-en-klaar meegegeven door de server-parent, als
   * een al-gerenderd element (zie de toelichting bij `icon` hierboven voor
   * waarom dit geen functie mag zijn).
   */
  utilityRight: ReactNode;
  /**
   * Zelfde soort inhoud als `utilityRight`, maar dan de "align left,
   * direction up"-variant — gebruikt in zowel de footer van de mobiele
   * drawer (< md) als de footer van de permanente zijbalk (>= md). Beide
   * zitten tegen de linkerrand, dus een paneel dat daaruit opent hoort naar
   * rechts/boven open te klappen — vandaar dat dezelfde prop nu op twee
   * plekken hergebruikt wordt.
   */
  utilityLeft: ReactNode;
  /** Bv. een extra link — in de footer van zowel de mobiele drawer als de permanente zijbalk. */
  footerExtra?: ReactNode;
}

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** localStorage-sleutel voor de onthouden in-/uitgeklapt-voorkeur van de permanente zijbalk. */
const NAV_COLLAPSE_STORAGE_KEY = "vyra:nav-collapsed";

/**
 * Herbruikbare navigatieschil voor de twee ingelogde portals (organisator
 * en leverancier).
 *
 * Onder `md` (telefoon, en iPad in smalle split-view): een hamburgermenu +
 * uitschuifdrawer — ongewijzigd, dat werkte al goed.
 *
 * Vanaf `md` (tablet/desktop): een PERMANENTE LINKERZIJBALK, zelf in-/uit
 * te klappen (Cem, aug. 2026: "dit uitklapscherm moet links staan en
 * uitklappen ... kijk bij concurrenten"). Dit vervangt de eerdere
 * bovenbalk-dropdown ("Vinted-stijl") — die verborg de navigatie achter een
 * klik en liet "waar ben ik nu" verdwijnen zodra het menu weer dichtklapte.
 * Onderzoek (Etsy Shop Manager, en de bredere 2026-trend "terug naar
 * collapsible left-sidebars" voor SaaS/portaaldashboards) wees allebei naar
 * hetzelfde: een vaste, altijd-zichtbare zijbalk oriënteert beter dan een
 * dropdown, en in-/uitklapbaar (icoon-only ↔ met labels) houdt 'm bruikbaar
 * op een kleiner scherm. Zelfde bewezen structurele opzet als AdminShell.tsx
 * (het zusje van deze balk in de adminomgeving) — met als extra dat de
 * gebruiker hem hier zelf in-/uitklapt (i.p.v. dat dit puur van het
 * breakpoint afhangt) en die keuze onthouden wordt.
 *
 * De in-/uitgeklapte stand wordt gespiegeld naar een `data-nav-collapsed`-
 * attribuut op `<html>` (zie --nav-sidebar-w in app/globals.css) — dat is
 * de brug naar de content-offset (`md:pl-[var(--nav-sidebar-w)]`) die elke
 * portal-layout.tsx los om zijn `<main>` zet: die layout is een Server
 * Component-sibling van deze Client Component en kan dus geen React-state
 * delen, een CSS-variabele via een DOM-attribuut wel.
 */
export function NavShell({
  items,
  logo,
  menuLabel,
  roleSwitch,
  secondaryAction,
  primaryAction,
  search,
  utilityRight,
  utilityLeft,
  footerExtra,
}: NavShellProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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

  // Voorkeur ophalen ná mount (localStorage bestaat niet server-side, en
  // <html> begint elke server-render zonder het attribuut) — dit geeft op
  // een verse paginalaad een kort moment de uitgeklapte stand te zien vóór
  // een eventuele eerder gekozen inklap-voorkeur wordt toegepast. Bewuste,
  // kleine trade-off: een blokkerend script vóór de eerste verf voorkomen
  // was hier niet de moeite waard t.o.v. de eenvoud van dit patroon.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(NAV_COLLAPSE_STORAGE_KEY);
    } catch {
      // localStorage kan geblokkeerd zijn (privénavigatie/instellingen) —
      // val dan gewoon terug op de uitgeklapte standaardstand.
    }
    if (stored === "true") {
      // Bewuste, eenmalige uitzondering op react-hooks/set-state-in-effect:
      // dit synchroniseert React-state met een externe bron (localStorage)
      // die pas ná mount beschikbaar is — precies het soort geval waar deze
      // regel voor bedoeld is een lint-uitzondering te krijgen, niet een
      // afgeleide-state-anti-pattern (er is geen prop/state om dit tijdens
      // render uit af te leiden, zoals bij het prevPathname-patroon hierboven).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
      document.documentElement.dataset.navCollapsed = "true";
    }
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      document.documentElement.dataset.navCollapsed = String(next);
      try {
        window.localStorage.setItem(NAV_COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        // Werkt deze sessie nog gewoon, wordt alleen niet onthouden.
      }
      return next;
    });
  }

  const roleSwitchPill = roleSwitch && (
    <div className="nav-collapsible flex shrink-0 items-center gap-0.5 rounded-full bg-paper-dim p-1" role="tablist" aria-label="Weergave wisselen">
      <Link
        href={roleSwitch.organizerHref}
        role="tab"
        aria-selected={roleSwitch.active === "organizer"}
        className={cn(
          "flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold transition-colors duration-[var(--duration-swift)]",
          roleSwitch.active === "organizer" ? "bg-paper text-ink shadow-[0_1px_3px_rgba(36,39,26,0.12)]" : "text-ink-faint hover:text-ink"
        )}
      >
        Organisator
      </Link>
      <Link
        href={roleSwitch.supplierHref}
        role="tab"
        aria-selected={roleSwitch.active === "supplier"}
        className={cn(
          "flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold transition-colors duration-[var(--duration-swift)]",
          roleSwitch.active === "supplier" ? "bg-paper text-ink shadow-[0_1px_3px_rgba(36,39,26,0.12)]" : "text-ink-faint hover:text-ink"
        )}
      >
        Leverancier
      </Link>
    </div>
  );

  const navList = (
    <>
      {items.map((item) => {
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "nav-item flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-[var(--duration-swift)]",
              active ? "bg-clay-50 text-clay-dark" : "text-ink-soft hover:bg-paper-dim hover:text-ink"
            )}
          >
            {item.icon}
            <span className="nav-label flex-1">{item.label}</span>
          </Link>
        );
      })}
      {secondaryAction && (
        <>
          <div className="nav-collapsible my-2 h-px bg-line-soft" />
          <Link
            href={secondaryAction.href}
            title={secondaryAction.label}
            className="nav-item flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-clay-dark transition-colors duration-[var(--duration-swift)] hover:bg-clay-50"
          >
            {secondaryAction.icon}
            <span className="nav-label">{secondaryAction.label}</span>
          </Link>
        </>
      )}
    </>
  );

  return (
    <>
      {/* ── Mobiele topstrook (< md) — ongewijzigd ── */}
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
        <div className="ml-auto flex items-center gap-1">{utilityRight}</div>
      </header>

      {/* ── Drawer (< md) — ongewijzigd ── */}
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
        {roleSwitch && (
          <div className="px-5 pt-4">
            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-paper-dim p-1" role="tablist" aria-label="Weergave wisselen">
              <Link
                href={roleSwitch.organizerHref}
                role="tab"
                aria-selected={roleSwitch.active === "organizer"}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold transition-colors duration-[var(--duration-swift)]",
                  roleSwitch.active === "organizer" ? "bg-paper text-ink shadow-[0_1px_3px_rgba(36,39,26,0.12)]" : "text-ink-faint hover:text-ink"
                )}
              >
                Organisator
              </Link>
              <Link
                href={roleSwitch.supplierHref}
                role="tab"
                aria-selected={roleSwitch.active === "supplier"}
                className={cn(
                  "flex-1 rounded-full px-3 py-1.5 text-center text-xs font-bold transition-colors duration-[var(--duration-swift)]",
                  roleSwitch.active === "supplier" ? "bg-paper text-ink shadow-[0_1px_3px_rgba(36,39,26,0.12)]" : "text-ink-faint hover:text-ink"
                )}
              >
                Leverancier
              </Link>
            </div>
          </div>
        )}
        {primaryAction && (
          <div className="px-5 pt-4">
            <LinkButton href={primaryAction.href} icon={primaryAction.icon} fullWidth variant="secondary">
              {primaryAction.label}
            </LinkButton>
          </div>
        )}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
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
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          {secondaryAction && (
            <>
              <div className="my-2 h-px bg-line-soft" />
              <Link
                href={secondaryAction.href}
                className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-clay-dark transition-colors duration-[var(--duration-swift)] hover:bg-clay-50"
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </Link>
            </>
          )}
        </nav>
        <div className="border-t border-line-soft px-5 py-4">
          <div className="flex items-center gap-2">{utilityLeft}</div>
          {footerExtra && <div className="mt-3">{footerExtra}</div>}
        </div>
      </Drawer>

      {/* ── Permanente linkerzijbalk (>= md), zelf in-/uit te klappen ── */}
      <aside
        data-testid="nav-sidebar"
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--nav-sidebar-w)] flex-col border-r border-line-soft bg-paper pt-[var(--safe-t)] pb-[var(--safe-b)] transition-[width] duration-200 ease-in-out md:flex"
      >
        <div className="flex items-center gap-2 px-4 py-4">
          <Link href="/" aria-label="Vyra — start" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink">
            <span className="font-display text-lg italic text-paper">V</span>
          </Link>
          <span className="nav-label font-display text-xl tracking-tight text-ink">Vyra</span>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={collapsed ? "Zijbalk uitklappen" : "Zijbalk inklappen"}
            aria-expanded={!collapsed}
            data-testid="nav-collapse-toggle"
            className="icon-pop ml-auto flex size-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink"
          >
            <ChevronLeft className={cn("size-4 transition-transform duration-200", collapsed && "rotate-180")} />
          </button>
        </div>

        {roleSwitchPill && <div className="px-3 pb-3">{roleSwitchPill}</div>}

        {primaryAction && (
          <div className="nav-collapsible px-3 pb-3">
            <LinkButton href={primaryAction.href} icon={primaryAction.icon} fullWidth variant="secondary">
              {primaryAction.label}
            </LinkButton>
          </div>
        )}

        {search && (
          <form
            action={search.action}
            className="nav-collapsible mx-3 mb-3 flex items-center gap-2 rounded-full bg-paper-dim px-3.5 py-2 text-sm text-ink-faint transition-shadow duration-[var(--duration-swift)] focus-within:text-ink focus-within:ring-2 focus-within:ring-clay/30"
          >
            <Search className="size-4 shrink-0" />
            <input
              type="text"
              name={search.name}
              placeholder={search.placeholder}
              className="w-full min-w-0 bg-transparent text-ink outline-none placeholder:text-ink-faint"
            />
          </form>
        )}

        <p className="nav-collapsible px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{menuLabel}</p>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">{navList}</nav>

        <div className="border-t border-line-soft px-3 py-3">
          <div className="nav-item flex items-center gap-2">{utilityLeft}</div>
          {footerExtra && <div className="nav-collapsible mt-3">{footerExtra}</div>}
        </div>
      </aside>
    </>
  );
}
