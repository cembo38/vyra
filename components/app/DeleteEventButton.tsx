"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { deleteEventAction } from "@/lib/actions/event-actions";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Verwijderen is onomkeerbaar (alle gekoppelde data gaat mee weg), dus
 * vraagt dit component eerst om de naam van het evenement over te typen
 * voordat de knop actief wordt — een gewone "weet je het zeker?"-dialoog
 * is te makkelijk per ongeluk weg te klikken bij zoiets definitiefs.
 */
export function DeleteEventButton({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-danger/30 bg-white px-3.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-50"
      >
        <Trash2 className="size-3.5" /> Evenement verwijderen
      </button>
    );
  }

  const matches = confirmText.trim() === eventName.trim();

  return (
    <div className="rounded-2xl border border-danger/30 bg-danger-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-medium text-danger">Dit kan niet ongedaan worden gemaakt</p>
            <p className="mt-1 text-sm text-danger/80">
              Alle gegevens van dit evenement — plan, aanvragen, offertes, berichten, betalingen en gasten — worden definitief
              verwijderd. Typ ter bevestiging de naam van het evenement (<span className="font-medium">{eventName}</span>) hieronder.
            </p>
          </div>
        </div>
        <button onClick={() => { setOpen(false); setConfirmText(""); }} aria-label="Annuleren" className="text-danger/70 hover:text-danger">
          <X className="size-4" />
        </button>
      </div>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={eventName}
        className="mt-3 w-full rounded-xl border border-danger/30 bg-white px-3 py-2 text-sm outline-none focus:border-danger"
      />
      <button
        disabled={!matches || pending}
        onClick={() => startTransition(async () => { await deleteEventAction(eventId); })}
        className="chip-hover mt-3 inline-flex items-center gap-1.5 rounded-full bg-danger px-4 py-2 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
      >
        {pending ? <VyraMarkSpinner className="text-sm" /> : <Trash2 className="size-3.5" />}
        Definitief verwijderen
      </button>
    </div>
  );
}
