"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Consistente terug-navigatie, gebruikt op elke geneste pagina (evenementen,
 * berichten, leveranciersaanvragen). Probeert eerst gewoon "terug" te gaan in
 * de browserhistorie (voelt het meest native aan — scrollpositie etc. blijft
 * behouden); heeft de gebruiker de pagina echter direct geopend (gedeelde
 * link, nieuw tabblad, favoriet) dan bestaat er geen "terug" binnen de app en
 * valt dit terug op een expliciete `fallbackHref`. `window.history.length`
 * is de gebruikelijke, pragmatische heuristiek hiervoor: 1 betekent dat dit
 * tabblad geen eigen navigatiehistorie heeft.
 *
 * `min-h-11` geeft een echte ~44px-tikdoel, ook al oogt de link zelf
 * compact — precies het probleem dat op de betaalpagina ontbrak.
 */
export function BackLink({ fallbackHref, label, className }: { fallbackHref: string; label: string; className?: string }) {
  const router = useRouter();

  function handleClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "icon-pop -ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-ink-faint hover:bg-paper-dim hover:text-ink",
        className
      )}
    >
      <ChevronLeft className="size-4" />
      {label}
    </button>
  );
}
