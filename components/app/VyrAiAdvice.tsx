"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cem (aug. 2026): "nog steeds is de lap tekst erg veel. kan je dit beter
 * weergeven. een uitklapscherm met 'klik hier voor wat VyrAI advies'" — de
 * AI-adviestekst (bv. op de budgetpagina) stond altijd volledig open, wat
 * als een lange lap tekst aanvoelde naast de rest van de pagina. Nu
 * standaard dichtgeklapt achter een trigger, met hetzelfde sage-kleurenblok
 * als voorheen zodra je 'm openklapt. `.motion-icon-twinkle` (bestaande,
 * prefers-reduced-motion-veilige animatie, zie app/globals.css) geeft het
 * sterretje de gevraagde "glinster".
 */
export function VyrAiAdvice({
  children,
  label = "Klik hier voor wat VyrAI-advies",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("rounded-xl bg-sage-50", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-sage-dark"
      >
        <Sparkles className="motion-icon-twinkle size-4 shrink-0" />
        <span className="flex-1">{label}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-sage-dark">
          {children}
        </div>
      )}
    </div>
  );
}
