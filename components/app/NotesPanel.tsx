"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles } from "lucide-react";
import { addNoteAction } from "@/lib/actions/event-actions";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import type { EventNote } from "@/lib/types";

/**
 * "Notitieblok" (sep. 2026, herontwerp dashboard): voorheen moest je eerst
 * een "+ Informatie toevoegen"-chip openklikken voordat er een tekstveld
 * verscheen (AddInfoWidget, nu vervangen door dit component), en de
 * bestaande notities stonden in een aparte kaart verderop op de pagina —
 * twee plekken voor wat bij elkaar hoort. Cem: "ik wil dat je een
 * notitieblok toevoegt voor personen dat ze snel even de aantekeningen
 * erin kunnen zetten" — nu altijd één kaart met een open tekstveld
 * bovenaan en de lijst er meteen onder, geen extra klik nodig.
 *
 * `addNoteAction` doet zelf al een `revalidatePath` (zie
 * lib/actions/event-actions.ts) — de `notes`-prop hieronder komt dus
 * vanzelf bijgewerkt terug van de server zodra die revalidatie is
 * voltooid; dit component hoeft de nieuwe notitie zelf niet lokaal toe te
 * voegen. Het toont wél meteen de VyrAI-signalering die de actie
 * teruggeeft, zodat er direct feedback is zonder op die revalidatie te
 * hoeven wachten.
 */
export function NotesPanel({ eventId, notes }: { eventId: string; notes: EventNote[] }) {
  const [text, setText] = useState("");
  const [impact, setImpact] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim() || pending) return;
    startTransition(async () => {
      const res = await addNoteAction(eventId, text.trim());
      setImpact(res?.impact ?? null);
      setText("");
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 [box-shadow:var(--shadow-card)]">
      <h2 className="mb-3 font-display text-lg text-ink">Notitieblok</h2>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (impact) setImpact(null);
          }}
          placeholder="Typ een snelle aantekening…"
          rows={2}
          className="w-full resize-none rounded-xl border border-line px-3 py-2 pr-11 text-sm outline-none focus:border-sage"
        />
        <VoiceInputButton
          className="absolute right-2 top-2 size-7"
          onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))}
        />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        {impact ? (
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-sage-dark">
            <Sparkles className="size-3.5 shrink-0" /> <span className="truncate">{impact}</span>
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={!text.trim() || pending}
          onClick={submit}
          className="chip-hover inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <Plus className="size-3.5" />}
          Toevoegen
        </button>
      </div>

      {notes.length > 0 && (
        <div className="mt-4 space-y-2.5 border-t border-line-soft pt-4">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl bg-paper-dim px-4 py-3">
              <p className="text-sm text-ink">{n.text}</p>
              {n.impactSummary && <p className="mt-1.5 text-xs text-sage-dark">✦ {n.impactSummary}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
