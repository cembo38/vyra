"use client";

import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Logo } from "@/components/marketing/Logo";
import { Button, LinkButton } from "@/components/ui/Button";

/**
 * Root `app/error.tsx`: vangt onverwachte crashes ergens in de app op i.p.v.
 * dat de gebruiker de kale "This page couldn't load"-pagina van Next/Vercel
 * te zien krijgt (precies wat er eerder deze sessie een paar keer gebeurde
 * bij echte bugs — CSRF-origin, de RSC-functieprop-crash, de Realtime-
 * kanaalbotsing). Dit is BEWUST geen vervanging voor het daadwerkelijk
 * oplossen van de onderliggende bug — die blijven we net zo hard opsporen —
 * maar wél een nette vangnet-pagina voor als er onverhoopt toch iets misgaat.
 *
 * `retry` (niet `reset`) is sinds Next 16.3.0 de stabiele prop-naam — zie
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
 * Error boundaries moeten Client Components zijn.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <Logo className="mb-10" />
      <div className="flex size-16 items-center justify-center rounded-full bg-danger-50 text-danger">
        <AlertTriangle className="size-7" />
      </div>
      <h1 className="mt-6 font-display text-2xl text-ink">Er ging iets mis</h1>
      <p className="mx-auto mt-2 max-w-sm text-ink-soft">
        Onze excuses — deze pagina kon niet worden geladen. Vaak helpt het om het gewoon nog eens te proberen.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => retry()} icon={<RotateCcw className="size-4" />}>
          Probeer opnieuw
        </Button>
        <LinkButton href="/" variant="outline" icon={<Home className="size-4" />}>
          Terug naar home
        </LinkButton>
      </div>
      {error.digest && <p className="mt-10 text-xs text-ink-faint">Foutcode: {error.digest}</p>}
    </main>
  );
}
