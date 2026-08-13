"use client";

import { useState, useTransition, useRef } from "react";
import { Sparkles, ArrowUp, Loader2 } from "lucide-react";
import { askAssistantAction } from "@/lib/actions/assistant-actions";

const SUGGESTIONS = ["Wat moet ik nog regelen?", "Welke leveranciers hebben nog niet gereageerd?", "Hoe staat mijn budget ervoor?", "Wat is urgent deze week?"];

export function AssistantWidget({ eventId }: { eventId: string }) {
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  function ask(question: string) {
    if (!question.trim() || pending) return;
    setInput("");
    startTransition(async () => {
      const res = await askAssistantAction(eventId, question);
      setThread((t) => [...t, { q: question, a: res.answer }]);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    });
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
              className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sage/50 hover:text-ink"
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
          placeholder="Stel een vraag over dit evenement…"
          className="flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Versturen"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
