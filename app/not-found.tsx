import { Compass, Home, Search } from "lucide-react";
import { Logo } from "@/components/marketing/Logo";
import { LinkButton } from "@/components/ui/Button";

export const metadata = { title: "Pagina niet gevonden — Vyra" };

/**
 * Root `app/not-found.tsx`: rendert binnen de root-layout (dus met de
 * normale fonts/kleuren/globals.css), en Next.js gebruikt 'm zowel voor een
 * expliciete `notFound()`-aanroep als voor elke URL die nergens op matcht
 * (sinds Next 13.3) — dus deze ene pagina dekt alle 404's in de hele app,
 * ingelogd of niet.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Logo className="mb-10" />
      <div className="flex size-16 items-center justify-center rounded-full bg-sage-50 text-sage">
        <Compass className="size-7" />
      </div>
      <p className="mt-6 font-display text-6xl text-ink">404</p>
      <h1 className="mt-2 font-display text-2xl text-ink">Deze pagina bestaat niet (meer)</h1>
      <p className="mx-auto mt-2 max-w-sm text-ink-soft">
        De link klopt niet meer, of de pagina is verplaatst. Geen zorgen — je evenementen en gegevens staan nog gewoon waar je ze achterliet.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <LinkButton href="/" icon={<Home className="size-4" />}>
          Terug naar home
        </LinkButton>
        <LinkButton href="/leveranciers" variant="outline" icon={<Search className="size-4" />}>
          Leveranciers zoeken
        </LinkButton>
      </div>
    </main>
  );
}
