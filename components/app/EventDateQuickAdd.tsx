"use client";

import { useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { updateEventDateAction } from "@/lib/actions/event-actions";
import { cn } from "@/lib/utils";

/**
 * Vervangt de platte "Datum nog niet bepaald"-tekst door een direct
 * klikbaar veldje: klikken opent meteen de systeem-datumkiezer (via een
 * onzichtbare, aan het label gekoppelde `<input type="date">`) — geen
 * aparte "bewerken"-stap of tussenpagina nodig.
 *
 * `stopPropagation` is nodig op plekken waar dit binnen een klikbare
 * kaart-Link staat (de evenementenlijst): zonder dat zou een klik op het
 * datumveld ook de link errond activeren en meteen wegnavigeren.
 */
export function EventDateQuickAdd({
  eventId,
  className,
  stopPropagation,
}: {
  eventId: string;
  className?: string;
  stopPropagation?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <label
      className={cn(
        "inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-clay transition-colors hover:text-clay-dark",
        pending && "pointer-events-none opacity-60",
        className
      )}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {pending ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <CalendarPlus className="size-3.5 shrink-0" />}
      Datum toevoegen
      <input
        type="date"
        className="sr-only"
        disabled={pending}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          const formData = new FormData();
          formData.set("date", value);
          startTransition(() => {
            updateEventDateAction(eventId, formData);
          });
        }}
      />
    </label>
  );
}
