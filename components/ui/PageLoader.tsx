import { cn } from "@/lib/utils";

/**
 * Laadindicator die de "V" uit het Vyra-logo hergebruikt (zie
 * components/marketing/Logo.tsx), zodat een pagina die aan het laden is
 * herkenbaar aanvoelt in plaats van een generieke spinner. Gebruikt als
 * fallback in de `loading.tsx`-bestanden — Next.js toont deze automatisch
 * zodra een route aan het navigeren/laden is (zie React Suspense).
 */
export function PageLoader({ fullScreen, className }: { fullScreen?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", fullScreen ? "min-h-screen" : "min-h-[40vh]", className)}>
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-2xl bg-ink [animation:var(--animate-mark-pulse)]"
      >
        <span className="font-display text-2xl italic text-paper">V</span>
      </span>
      <span className="sr-only">Bezig met laden…</span>
    </div>
  );
}

/**
 * Kleine, inline variant van de V hierboven — voor gebruik ALS
 * pending-indicator in een knop (zie components/ui/SubmitButton.tsx), i.p.v.
 * een hele pagina. Livegang-incident aug. 2026: het inloggen leek "kapot"
 * (geen enkele visuele reactie op klikken) terwijl het in werkelijkheid
 * gewoon traag was — een submit-knop zonder enige laadindicator is dan niet
 * te onderscheiden van een kapotte knop. Bewust geen los vierkantje/badge
 * zoals hierboven (dat zou op de meestal al donkere knopachtergrond
 * nauwelijks zichtbaar zijn) — gewoon de pulserende letter zelf, die z'n
 * kleur van de omliggende knoptekst overneemt.
 */
export function VyraMarkSpinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("font-display italic leading-none [animation:var(--animate-mark-pulse)]", className)}>
      V
    </span>
  );
}
