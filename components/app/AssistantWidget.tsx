"use client";

import { useState, useTransition, useRef } from "react";
import { Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { askAssistantAction } from "@/lib/actions/assistant-actions";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { usePersistedBoolean } from "@/lib/hooks/usePersistedBoolean";

const SUGGESTIONS = ["Wat moet ik nog regelen?", "Welke leveranciers hebben nog niet gereageerd?", "Hoe staat mijn budget ervoor?", "Wat is urgent deze week?"];

/**
 * Herontwerp (sep. 2026): stond voorheen altijd volledig open — een hele
 * chatkaart, ook als 'm nooit gebruikt werd. Nu standaard een rustige,
 * ingeklapte balk; open 'm eenmaal en dat blijft onthouden (zelfde
 * localStorage-aanpak als ExpandToggle, via usePersistedBoolean — zie
 * lib/hooks/usePersistedBoolean.ts — hier net iets anders opgebouwd omdat
 * de "dicht"-stand een hele andere knop is, geen "toon meer"-link onder
 * bestaande inhoud). Een lopend gesprek (`thread`) blijft altijd
 * zichtbaar, ongeacht de onthouden voorkeur — die zou anders verdwijnen
 * zodra je 'm net had ingeklapt.
 */
export function AssistantWidget({ eventId }: { eventId: string }) {
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = usePersistedBoolean("vyra:uitgeklapt:assistant", true);
  const endRef = useRef<HTMLDivElement>(null);

  function expand() {
    setCollapsed(false);
  }

  function ask(question: string) {
    if (!question.trim() || pending) return;
    setInput("");
    startTransition(async () => {
      const res = await askAssistantAction(eventId, question);
      setThread((t) => [...t, { q: question, a: res.answer }]);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  if (collapsed && thread.length === 0) {
    return (
      <button
        type="button"
        onClick={expand}
        className="chip-hover flex w-full items-center gap-2.5 rounded-2xl border border-line bg-paper-dim px-4 py-3 text-left [box-shadow:var(--shadow-card)]"
      >
        <Sparkles className="size-4 shrink-0 text-sage" />
        <span className="text-sm text-ink-faint">Vraag het aan je AI Event Manager…</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 [box-shadow:var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
          <Sparkles className="size-4.5" />
        </div>
        <div>
          <p className="font-display text-lg text-ink">Je AI Event Manager</p>
          <p className="text-xs text-ink-faint">Vraag alles over dit evenement</p>
        </div>
      </div>

      {thread.length === 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="chip-hover rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft hover:border-sage/50 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 no-scrollbar">
          {thread.map((t, i) => (
            <div key={i} className="space-y-1.5">
              <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-tr-sm bg-ink px-3.5 py-2 text-sm text-paper">{t.q}</p>
              <p className="w-fit max-w-[90%] rounded-2xl rounded-tl-sm bg-paper-dim px-3.5 py-2 text-sm text-ink">{t.a}</p>
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 text-xs text-ink-faint">
              <Loader2 className="size-3.5 animate-spin" /> Even denken…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="mt-4 flex items-center gap-2 rounded-full border border-line bg-paper px-1.5 py-1.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Typ of spreek je vraag in…"
          className="flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-faint"
        />
        <VoiceInputButton className="size-9" onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))} />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Versturen"
          className="icon-pop flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
