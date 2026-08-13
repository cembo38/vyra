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
