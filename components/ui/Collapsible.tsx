"use client";

import { ReactNode, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Cem (aug. 2026), over de leveranciers-bedrijfsprofielpagina: "Het moet
 * clean zijn... Ik zie veel blokken met veel tekst. maak het clean.
 * Eventueel met uitklaptoetsen (bijvoorbeeld de abonnementen)." — generieke
 * uitklapsectie voor blokken die wél op een pagina thuishoren, maar te veel
 * ruimte/tekst innemen om altijd open te staan (Abonnement, Pakketten,
 * Profiel aankleden). Titel + korte beschrijving blijven altijd zichtbaar
 * (voor context/scanbaarheid), alleen de zware inhoud verschijnt pas na
 * klikken.
 *
 * BEWUST via CSS verborgen (`hidden`-klasse) i.p.v. de children pas te
 * renderen na openklappen: op de bedrijfsprofielpagina zit "Profiel
 * aankleden" (tagline/coverfoto/video) binnen hetzelfde <form> als de rest
 * van het profiel — zouden die velden ongemount zijn zolang de sectie dicht
 * staat, dan mist FormData ze bij het opslaan, en interpreteert
 * updateSupplierProfileAction een ontbrekend veld als "leeg gemaakt", wat
 * een eerder ingevulde waarde zou wissen. Een met CSS verborgen input
 * (display: none) blijft gewoon meedoen in FormData bij submit.
 */
export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-h-11 items-start justify-between gap-3 rounded-xl text-left"
      >
        <div>
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-ink-faint">
            {title}
            {badge}
          </h2>
          {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
        </div>
        <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("mt-4", !open && "hidden")}>{children}</div>
    </div>
  );
}
