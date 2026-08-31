"use client";

import { useState, useTransition } from "react";
import { Check, Lock, RotateCcw } from "lucide-react";
import { closeEventAction, reopenEventAction } from "@/lib/actions/event-actions";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Sluiten/heropenen wijzigt alleen de stage van het evenement (geen
 * dataverlies), dus een lichte inline bevestiging volstaat hier — in
 * tegenstelling tot verwijderen, wat definitief is.
 */
export function CloseEventButton({ eventId, cancelled }: { eventId: string; cancelled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (cancelled) {
    return (
      <button
        disabled={pending}
        onClick={() => startTransition(async () => { await reopenEventAction(eventId); })}
        className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
      >
        {pending ? <VyraMarkSpinner className="text-sm" /> : <RotateCcw className="size-3.5" />}
        Evenement heropenen
      </button>
    );
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-xs text-ink-faint">Evenement sluiten?</span>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await closeEventAction(eventId); })}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <Check className="size-3.5" />}
          Ja, sluiten
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-ink-faint hover:text-ink">
          Annuleren
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-ink"
    >
      <Lock className="size-3.5" /> Evenement sluiten
    </button>
  );
}
