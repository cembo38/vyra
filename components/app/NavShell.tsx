"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Search } from "lucide-react";
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
  /** Logo (met woordmerk) — mobiele strook, drawer-header, topbalk. */
  logo: ReactNode;
  /** Titel op de knop die in de topbalk (>= md) het uitklapmenu met `items` opent — bv. "Ontdek leveranciers" of "Leveranciersportaal". */
  menuLabel: string;
  /**
   * Klein segmented-knopje ("Organisator"/"Leverancier") vlak naast het
   * uitklapmenu, alleen meegeven als iemand ECHT beide rollen heeft (dus
   * een bestaand leveranciersprofiel) — zie AppTopBar/SupplierTopBar voor
   * de precieze voorwaarde per kant.
   *
   * Aanleiding: `items` bevatte voorheen een los kruispunt-item
   * ("Leveranciersportaal" tussen de organisator-punten, of "Mijn
   * evenementen" tussen de leveranciersportaal-punten) — voor iemand met
   * beide rollen voelde dat als twee werelden door elkaar in één lijst
   * (expliciet zo benoemd: "dat zit er rommelig uit"). Met dit knopje
   * ernaast toont `items` voortaan ALTIJD alleen de punten van de huidige
   * weergave, en gebeurt het wisselen zelf via een eigen, duidelijk
   * zichtbaar controletje in plaats van als item tussen de rest.
   */
  roleSwitch?: NavShellRoleSwitch;
  /**
   * Visueel afwijkend (groen, met scheidingslijn erboven) item onderaan het
   * uitklapmenu/de drawer — voor een actie die niet bij de gewone
   * navigatie hoort maar ook geen los kruispunt is, zoals "Ook leverancier
   * worden?" voor wie nog geen leveranciersprofiel heeft (en dus geen
   * `roleSwitch` krijgt, want er is nog niets om naar te wisselen).
   */
  secondaryAction?: { href: string; label: string; icon: ReactNode };
  primaryAction?: { href: string; label: string; icon?: ReactNode };
  /**
   * Optioneel zoekveld in de topbalk (>= md) — alleen meegeven als er
   * ergens écht een pagina is die de `name`-queryparameter oppikt (bv.
   * `/leveranciers?q=...`, zie `app/leveranciers/page.tsx`). Geen
   * schijnfunctie: als er geen echte zoekbestemming is (zoals nu bij het
   * leveranciersportaal, dat nog geen doorzoekbare aanvragenlijst heeft),
   * laat deze prop dan gewoon weg i.p.v. een zoekveld te tonen dat nergens
   * naartoe leidt.
   */
  search?: { action: string; name: string; placeholder: string };
  /**
   * Notificatiebel + avatar (+ eventueel uitlogknop), kant-en-klaar
   * meegegeven door de server-parent (die de gebruiker al heeft
   * opgehaald) — als een al-gerenderd element, geen functie: `NavShell`
   * is een Client Component en de parents (`AppTopBar`, `SupplierTopBar`)
   * zijn Server Components, en een functie is niet serialiseerbaar over
   * die grens (crasht met "Functions cannot be passed directly to Client
   * Components", precies zoals hierboven bij `icon` al staat toegelicht).
   * Wordt zowel in de mobiele topstrook als in de topbalk (>= md) gebruikt.
   */
  utilityRight: ReactNode;
  /** Zelfde als `utilityRight`, maar dan voor de footer van het mobiele uitschuifmenu (< md) — die zit tegen de linkerrand, dus het paneel klapt daar naar rechts open in plaats van naar links. */
  utilityLeft: ReactNode;
  /** Bv. een extra link — alleen in de footer van het mobiele uitschuifmenu (< md). */
  footerExtra?: ReactNode;
}

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Herkenningslabel op eigen `vyra:overlay-open`-berichten, zie de toelichting bij de listener hieronder. */
const NAV_MENU_OVERLAY_SOURCE = "nav-menu";

/**
 * Herbruikbare navigatieschil voor de twee ingelogde portals (organisator
 * en leverancier). Onder `md` (telefoon, en iPad in smalle split-view):
 * een hamburgermenu + uitschuifdrawer — dat loste eerder precies het
 * "geen terugknop / knoppen te groot"-probleem op en blijft ongewijzigd.
 * Vanaf `md` (tablet/desktop): geen vaste zijbalk meer, maar een rustige
 * balk BOVENAAN met een uitklapmenu, in de opzet van Vinted's topbalk
 * (Catalogus-dropdown, zoekveld, iconen rechts, groene actieknop) — zie
 * het besproken en goedgekeurde voorstel. De balk is `sticky` (neemt
 * gewoon ruimte in de normale pagina-flow in), dus pagina's hoeven —
 * anders dan bij de vorige `position: fixed`-zijbalk — geen aparte
 * offset-klasse meer toe te passen.
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
    setMenuOpen(false);
  }

  // Zelfde patroon als het notificatiepaneel (`NotificationsBell.tsx`):
  // sluiten bij een klik buiten het paneel, en bij Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Sluit dit menu zodra ergens anders een drawer of ander paneel opent
  // (zie components/ui/Drawer.tsx) — en meld zelf ook zo'n "overlay open"
  // moment, zodat bv. een openstaand notificatiepaneel op zijn beurt sluit.
  //
  // LET OP: dit uitklapmenu is (voor zover bekend) het enige paneel dat
  // het `vyra:overlay-open`-event zowel VERSTUURT als BELUISTERT — Drawer
  // verstuurt het alleen, NotificationsBell beluistert het alleen. Zonder
  // onderscheid hoort dit menu zijn eigen bericht en sluit het zichzelf
  // ONMIDDELLIJK weer na het openen (geverifieerd: klikken op de knop deed
  // zichtbaar niets, want open→eigen event→dicht gebeurde binnen dezelfde
  // klikafhandeling). Vandaar het `detail.source`-veld hieronder: alleen
  // een bericht van een ANDER paneel mag dit menu sluiten.
  useEffect(() => {
    function onOtherOverlayOpen(e: Event) {
      const source = e instanceof CustomEvent ? (e.detail as { source?: string } | undefined)?.source : undefined;
      if (source === NAV_MENU_OVERLAY_SOURCE) return;
      setMenuOpen(false);
    }
    window.addEventListener("vyra:overlay-open", onOtherOverlayOpen);
    return () => window.removeEventListener("vyra:overlay-open", onOtherOverlayOpen);
  }, []);

  function toggleMenu() {
    setMenuOpen((v) => {
      if (!v) window.dispatchEvent(new CustomEvent("vyra:overlay-open", { detail: { source: NAV_MENU_OVERLAY_SOURCE } }));
      return !v;
    });
  }

  const roleSwitchPill = roleSwitch && (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-paper-dim p-1" role="tablist" aria-label="Weergave wisselen">
      <Link
        href={roleSwitch.organizerHref}
        role="tab"
        aria-selected={roleSwitch.active === "organizer"}
        className={cn(
          "rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-[var(--duration-swift)]",
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
          "rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-[var(--duration-swift)]",
          roleSwitch.active === "supplier" ? "bg-paper text-ink shadow-[0_1px_3px_rgba(36,39,26,0.12)]" : "text-ink-faint hover:text-ink"
        )}
      >
        Leverancier
      </Link>
    </div>
  );

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
        <div className="ml-auto flex items-center gap-1">{utilityRight}</div>
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
        {roleSwitchPill && <div className="px-5 pt-4">{roleSwitchPill}</div>}
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

      {/* ── Topbalk (>= md) — Vinted-achtige opzet, in Vyra-stijl ── */}
      <header className="sticky top-0 z-40 hidden items-center gap-3 border-b border-line bg-paper/90 px-5 py-2.5 backdrop-blur-md pt-[calc(var(--safe-t)+0.625rem)] md:flex">
        {logo}

        {roleSwitchPill}

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={toggleMenu}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            data-testid="nav-menu-trigger"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-soft transition-colors duration-[var(--duration-swift)] hover:bg-paper-dim hover:text-ink"
          >
            {menuLabel}
            <ChevronDown className={cn("size-3.5 transition-transform duration-[var(--duration-swift)]", menuOpen && "rotate-180")} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              data-testid="nav-menu-panel"
              className="absolute left-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-line-soft bg-white py-1.5 shadow-[var(--shadow-pop)]"
            >
              {items.map((item) => {
                const active = isActive(item.href, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors duration-[var(--duration-swift)]",
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
                  <div className="my-1 mx-2 h-px bg-line-soft" />
                  <Link
                    href={secondaryAction.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-clay-dark transition-colors duration-[var(--duration-swift)] hover:bg-clay-50"
                  >
                    {secondaryAction.icon}
                    {secondaryAction.label}
                  </Link>
                </>
              )}
            </div>
          )}
        </div>

        {search && (
          <form
            action={search.action}
            className="flex min-w-0 max-w-md flex-1 items-center gap-2 rounded-full bg-paper-dim px-3.5 py-2 text-sm text-ink-faint transition-shadow duration-[var(--duration-swift)] focus-within:text-ink focus-within:ring-2 focus-within:ring-clay/30"
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

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {utilityRight}
          {primaryAction && (
            <LinkButton href={primaryAction.href} variant="secondary" size="sm" icon={primaryAction.icon} className="ml-1">
              {primaryAction.label}
            </LinkButton>
          )}
        </div>
      </header>
    </>
  );
}
