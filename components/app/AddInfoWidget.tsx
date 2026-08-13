"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles, Loader2, X } from "lucide-react";
import { addNoteAction } from "@/lib/actions/event-actions";

export function AddInfoWidget({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [impact, setImpact] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-ink"
      >
        <Plus className="size-3.5" /> Informatie toevoegen
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-line bg-white p-4 shadow-sm sm:max-w-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Wat wil je toevoegen of aanpassen?</p>
        <button onClick={() => { setOpen(false); setImpact(null); setText(""); }} aria-label="Sluiten" className="text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      {!impact ? (
        <>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Bijv. 'Er komen uiteindelijk 135 gasten' of 'Mijn budget is verhoogd naar €30.000'"
            rows={3}
            className="w-full resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-sage"
          />
          <button
            disabled={!text.trim() || pending}
            onClick={() =>
              startTransition(async () => {
                const res = await addNoteAction(eventId, text.trim());
                setImpact(res?.impact ?? "Toegevoegd aan je evenement.");
              })
            }
            className="chip-hover mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Toevoegen
          </button>
        </>
      ) : (
        <div className="rounded-xl bg-sage-50 p-3 text-sm text-sage-dark">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
            <Sparkles className="size-3.5" /> AI-signalering
          </div>
          {impact}
        </div>
      )}
    </div>
  );
}
