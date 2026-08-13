"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, ArrowUp, Loader2, AlertTriangle } from "lucide-react";
import { startInterviewAction, continueInterviewAction, generatePlanAction } from "@/lib/actions/event-actions";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

const STARTERS = [
  "Ik wil in juni een luxe bruiloft organiseren voor ongeveer 120 mensen in Amsterdam.",
  "Ik wil thuis een groot verjaardagsfeest geven voor mijn 40e verjaardag.",
  "Ik wil een kerstborrel voor mijn bedrijf organiseren voor 80 medewerkers.",
];

export function NewEventInterview() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Wat wil je organiseren?" }]);
  const [input, setInput] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  function scrollDown() {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending || done) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    scrollDown();

    startTransition(async () => {
      try {
        if (!eventId) {
          const res = await startInterviewAction(trimmed);
          setEventId(res.eventId);
          setMessages((m) => [...m, { role: "assistant", text: res.assistantMessage }]);
          setDone(res.done);
        } else {
          const res = await continueInterviewAction(eventId, trimmed);
          setMessages((m) => [...m, { role: "assistant", text: res.assistantMessage }]);
          setDone(res.done);
        }
        scrollDown();
      } catch {
        setError("Onze AI reageert nu niet. Probeer het nog eens — je antwoorden blijven bewaard.");
      }
    });
  }

  function goToPlan() {
    if (!eventId) return;
    startTransition(async () => {
      try {
        await generatePlanAction(eventId);
      } catch {
        setError("Het genereren van je plan lukte niet. Probeer het nog eens.");
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-0px)] max-w-2xl flex-col px-6 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
          <Sparkles className="size-4.5" />
        </div>
        <div>
          <p className="font-display text-lg text-ink">AI Event Interview</p>
          <p className="text-xs text-ink-faint">Vertel me over je evenement — ik stel gerichte vervolgvragen.</p>
        </div>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto pb-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] animate-fade-in rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
              m.role === "assistant" ? "rounded-tl-sm bg-white border border-line-soft text-ink" : "ml-auto rounded-tr-sm bg-ink text-paper"
            )}
          >
            {m.text}
          </div>
        ))}
        {pending && (
          <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-tl-sm border border-line-soft bg-white px-4 py-3 text-ink-faint">
            <Loader2 className="size-4 animate-spin" /> Even denken…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="chip-hover rounded-full border border-line bg-white px-3.5 py-1.5 text-left text-xs text-ink-soft hover:border-clay/50 hover:text-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {done ? (
        <button
          onClick={goToPlan}
          disabled={pending}
          className="lift-hover inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-clay-dark disabled:opacity-60 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Bekijk mijn AI-eventplan
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Typ je antwoord…"
            className="max-h-32 flex-1 resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            aria-label="Versturen"
            className="icon-pop flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowUp className="size-4.5" />
          </button>
        </form>
      )}
    </div>
  );
}
