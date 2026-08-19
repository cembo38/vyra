"use client";

// `global-error` vervangt de HELE root-layout (inclusief <html>/<body>) en
// erft dus NIETS automatisch mee — geen globale stijlen, geen lettertypes.
// We importeren `globals.css` hier expliciet zodat de Tailwind-klassen en
// merkkleuren hieronder wél werken; bewust GEEN `@fontsource`-imports (die
// zijn zwaarder) — dit bestand is het allerlaatste vangnet (een crash in de
// root-layout zelf, extreem zeldzaam) en moet zo licht mogelijk blijven.
import "./globals.css";
import { useEffect } from "react";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="nl">
      <body className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-16 text-center text-ink antialiased">
        <span className="mb-8 flex size-10 items-center justify-center rounded-xl bg-ink text-lg italic text-paper">V</span>
        <h1 className="text-2xl font-semibold text-ink">Er ging iets mis</h1>
        <p className="mx-auto mt-2 max-w-sm text-ink-soft">
          Onze excuses — Vyra kon niet laden. Probeer de pagina opnieuw te laden.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => retry()}
            className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-paper hover:bg-ink/90"
          >
            Probeer opnieuw
          </button>
          {/* Bewust een gewone <a>, geen next/link `<Link>`: dit bestand
              vervangt de HELE root-layout omdat de root-layout zélf is
              gecrasht — de router-context waar `<Link>` op leunt kan op dat
              moment net zo goed kapot zijn. Een gewone volledige
              paginanavigatie werkt altijd, ongeacht de staat van de router. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-medium text-ink hover:bg-paper-dim">
            Terug naar home
          </a>
        </div>
        {error.digest && <p className="mt-10 text-xs text-ink-faint">Foutcode: {error.digest}</p>}
      </body>
    </html>
  );
}
