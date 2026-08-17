import Link from "next/link";
import { Search, LogOut } from "lucide-react";
import { UserAvatar } from "@/components/ui/Avatar";
import { LinkButton } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth-actions";
import { MarketingNavDrawer } from "@/components/marketing/MarketingNavDrawer";

const MARKETING_LINKS = [
  { href: "/#hoe-het-werkt", label: "Hoe het werkt" },
  { href: "/#evenementen", label: "Voor elk evenement" },
  { href: "/supplier", label: "Voor leveranciers" },
];

function SearchSuppliersButton() {
  return (
    <LinkButton href="/leveranciers" size="sm" variant="outline" icon={<Search className="size-3.5" />} className="hidden md:inline-flex">
      Leveranciers zoeken
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
        <SearchSuppliersButton />
        <LinkButton href="/events" size="sm" iconRight={<span aria-hidden>→</span>}>
          {user.firstName ? `${user.firstName}'s Vyra` : "Mijn Vyra"}
        </LinkButton>
        {/* Uitloggen i.p.v. een link naar het profiel — dat blijft bereikbaar via het
            uitklapmenu hieronder ("Mijn profiel") en via de avatar in de ingelogde app zelf. */}
        <form action={logoutAction} className="hidden sm:block">
          <button
            type="submit"
            aria-label="Uitloggen"
            className="icon-pop flex size-9 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </form>
        <MarketingNavDrawer
          links={MARKETING_LINKS}
          footer={
            <>
              <Link href="/profile" className="flex items-center gap-2.5 text-sm font-medium text-ink hover:text-ink">
                <UserAvatar firstName={user.firstName || "?"} lastName={user.lastName} color={user.avatarColor} size={28} />
                Mijn profiel
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
      <SearchSuppliersButton />
      <Link href="/login" className="nav-link hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
        Inloggen
      </Link>
      <LinkButton href="/events/new" size="sm" iconRight={<span aria-hidden>→</span>}>
        <span className="sm:hidden">Start</span>
        <span className="hidden sm:inline">Start mijn evenement</span>
      </LinkButton>
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
      <SearchSuppliersButton />
      <Link href="/login" className="nav-link hidden text-sm font-medium text-ink-soft hover:text-ink sm:block">
        Inloggen
      </Link>
      <LinkButton href="/events/new" size="sm" iconRight={<span aria-hidden>→</span>}>
        <span className="sm:hidden">Start</span>
        <span className="hidden sm:inline">Start mijn evenement</span>
      </LinkButton>
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
          </>
        }
      />
    </div>
  );
}
