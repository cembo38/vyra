import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { SUBSCRIPTION_TIERS, formatCurrency } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-line-soft py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-ink-faint">
              Het AI-platform voor het organiseren van ieder evenement — van intiem diner tot groots bedrijfsfeest.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <p className="font-medium text-ink">Organisatoren</p>
              <div className="mt-3 flex flex-col gap-2 text-ink-faint">
                <Link href="/events/new" className="nav-link hover:text-ink">Start een evenement</Link>
                <Link href="/#hoe-het-werkt" className="nav-link hover:text-ink">Hoe het werkt</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-ink">Leveranciers</p>
              <div className="mt-3 flex flex-col gap-2 text-ink-faint">
                <Link href="/supplier" className="nav-link hover:text-ink">Word aanbieder</Link>
                <Link href="/supplier" className="nav-link hover:text-ink">Leveranciersdashboard</Link>
              </div>
            </div>
            <div>
              <p className="font-medium text-ink">Platform</p>
              <div className="mt-3 flex flex-col gap-2 text-ink-faint">
                <Link href="/privacy" className="nav-link hover:text-ink">Privacyverklaring</Link>
                <Link href="/voorwaarden" className="nav-link hover:text-ink">Algemene voorwaarden</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-line-soft pt-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Vyra. Alle rechten voorbehouden.</p>
          {/* Sinds het nieuwe tarievenmodel (aug. 2026): leveranciers starten
              gratis op Instap (commissie per boeking) of kiezen direct een
              abonnement — zie SUBSCRIPTION_TIERS in lib/config.ts. Organisatoren
              betalen nooit een aparte platformkostenregel. */}
          <p>Leveranciers starten gratis bij Vyra, of kiezen een abonnement vanaf {formatCurrency(SUBSCRIPTION_TIERS.starter.billing!.monthly.priceCents)}/maand — organisatoren betalen nooit platformkosten.</p>
        </div>
      </div>
    </footer>
  );
}
