import Link from "next/link";
import { Search, Sparkles, LogOut } from "lucide-react";
import { UserAvatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth-actions";
import { MarketingNavDrawer } from "@/components/marketing/MarketingNavDrawer";
import { SubmitButton } from "@/components/ui/SubmitButton";

const MARKETING_LINKS = [
  { href: "/#hoe-het-werkt", label: "Hoe het werkt" },
  { href: "/#evenementen", label: "Voor elk evenement" },
  { href: "/supplier", label: "Voor leveranciers" },
];

/**
 * Icoon-eerst: het label klapt pas open bij hover (`.expand-hover`), zodat
 * dit de opvallende hoofdknop kan zijn zonder de header vol te proppen. Op
 * touchscreens (geen hover) staat de tekst gewoon altijd naast het icoon —
 * zie de mediaquery in globals.css.
 */
function SearchSuppliersButton() {
  return (
    <LinkButton
      href="/leveranciers"
      size="sm"
      variant="primary"
      expandOnHover
      icon={<Search className="size-4" />}
      ariaLabel="Leveranciers zoeken"
      className="!gap-0 px-2.5"
    >
      Leveranciers zoeken
    </LinkButton>
  );
}

/** Zelfde opzet als `SearchSuppliersButton`, maar als secundaire (outline) knop — zie de toelichting daar. */
function StartEventButton() {
  return (
    <LinkButton
      href="/events/new"
      size="sm"
      variant="outline"
      expandOnHover
      icon={<Sparkles className="size-4" />}
      ariaLabel="Start mijn evenement"
      className="!gap-0 px-2.5"
    >
      Start mijn evenement
    </LinkButton>
  );
}

/**
 * Rechterkant van de marketingheader, bewust los van `MarketingHeader`
 * gehouden en in een <Suspense> gewrapt: zo blijft de rest van de
 * (statische) pagina meteen zichtbaar terwijl hier de sessie wordt
 * gecontroleerd. Zonder dit toonde de hoofdpagina altijd "Inloggen", ook
 * als je al was ingelogd — wat aanvoelde alsof je was uitgelogd.
 */
export async function HeaderAuthArea() {
  const user = await getCurrentUser();

  if (user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Onder `sm` (telefoon) is er te weinig breedte voor logo + deze knop + de
            hierna volgende knop + het menu-icoon tegelijk — dat gaf overlappende
            knoppen. Beide acties (Mijn Vyra, Leveranciers zoeken) blijven op mobiel
            gewoon bereikbaar via het uitklapmenu hiernaast. */}
        <span className="hidden md:inline-flex"><SearchSuppliersButton /></span>
        <LinkButton href="/events" size="sm" iconRight={<span aria-hidden>→</span>} className="hidden md:inline-flex">
          {user.firstName ? `${user.firstName}'s Vyra` : "Mijn Vyra"}
        </LinkButton>
        {/* Uitloggen i.p.v. een link naar het profiel — dat blijft bereikbaar via het
            uitklapmenu hieronder ("Mijn profiel") en via de avatar in de ingelogde app zelf. */}
        <form action={logoutAction} className="hidden md:block">
          <SubmitButton
            iconOnly
            aria-label="Uitloggen"
            className="icon-pop flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink"
          >
            <LogOut className="size-4" />
          </SubmitButton>
        </form>
        <MarketingNavDrawer
          links={MARKETING_LINKS}
          footer={
            <>
              <Link href="/profile" className="flex items-center gap-2.5 text-sm font-medium text-ink hover:text-ink">
                <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} size={28} />
                Mijn profiel
              </Link>
              <Link href="/events" className="block text-sm font-medium text-ink-soft hover:text-ink">
                {user.firstName ? `${user.firstName}'s Vyra` : "Mijn Vyra"}
              </Link>
              <Link href="/leveranciers" className="block text-sm font-medium text-ink-soft hover:text-ink">
                Leveranciers zoeken
              </Link>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden md:inline-flex"><SearchSuppliersButton /></span>
      <span className="hidden md:inline-flex"><StartEventButton /></span>
      <Link href="/login" className="nav-link hidden text-sm font-medium text-ink-soft hover:text-ink md:block">
        Inloggen
      </Link>
      <MarketingNavDrawer
        links={MARKETING_LINKS}
        footer={
          <>
            <Link href="/login" className="block text-sm font-medium text-ink hover:text-ink">
              Inloggen
            </Link>
            <Link href="/events/new" className="block text-sm font-medium text-clay hover:text-clay-dark">
              Start mijn evenement
            </Link>
            <Link href="/leveranciers" className="block text-sm font-medium text-ink-soft hover:text-ink">
              Leveranciers zoeken
            </Link>
          </>
        }
      />
    </div>
  );
}

/** Fallback tijdens het laden — identiek aan de uitgelogde staat, zodat er geen zichtbare sprong is voor bezoekers die nog niet zijn ingelogd. */
export function HeaderAuthAreaFallback() {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden md:inline-flex"><SearchSuppliersButton /></span>
      <span className="hidden md:inline-flex"><StartEventButton /></span>
      <Link href="/login" className="nav-link hidden text-sm font-medium text-ink-soft hover:text-ink md:block">
        Inloggen
      </Link>
      <MarketingNavDrawer
        links={MARKETING_LINKS}
        footer={
          <>
            <Link href="/login" className="block text-sm font-medium text-ink hover:text-ink">
              Inloggen
            </Link>
            <Link href="/events/new" className="block text-sm font-medium text-clay hover:text-clay-dark">
              Start mijn evenement
            </Link>
            <Link href="/leveranciers" className="block text-sm font-medium text-ink-soft hover:text-ink">
              Leveranciers zoeken
            </Link>
          </>
        }
      />
    </div>
  );
}
