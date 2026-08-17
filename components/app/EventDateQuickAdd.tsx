"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { updateEventDateAction } from "@/lib/actions/event-actions";
import { cn } from "@/lib/utils";

/**
 * Vervangt de platte "Datum nog niet bepaald"-tekst door een direct
 * klikbaar veldje. Bewust GEEN onzichtbaar <input> achter een <label>
 * (dat leek eerst een goed idee, maar het "klik-op-label-opent-de-
 * systeempicker"-gedrag is onbetrouwbaar — met name Safari op macOS opent
 * de kalender niet als het onderliggende veld geen echte, zichtbare
 * afmeting heeft). In plaats daarvan toont een klik een normaal, écht
 * zichtbaar `<input type="date">` — dat werkt in elke browser gegarandeerd,
 * met of zonder de `showPicker()`-bonus hieronder.
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
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Bonus: opent op ondersteunende browsers meteen de systeem-kalender
    // i.p.v. dat je zelf nog op het veld moet klikken. Niet overal
    // beschikbaar (bv. oudere Safari-versies) — de try/catch zorgt dat het
    // zichtbare, gefocuste veld het dan gewoon als normaal datumveld doet.
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // negeren
      }
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        disabled={pending}
        className={cn("w-[9.5rem] rounded-lg border border-line px-2 py-1 text-sm text-ink outline-none focus:border-clay", className)}
        onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          const formData = new FormData();
          formData.set("date", value);
          startTransition(() => {
            updateEventDateAction(eventId, formData);
          });
        }}
        onBlur={(e) => {
          if (!e.target.value) setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        setEditing(true);
      }}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 text-sm font-medium text-clay transition-colors hover:text-clay-dark",
        pending && "pointer-events-none opacity-60",
        className
      )}
    >
      {pending ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <CalendarPlus className="size-3.5 shrink-0" />}
      Datum toevoegen
    </button>
  );
}
