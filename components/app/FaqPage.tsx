"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import { ArrowUp, ChevronDown, HelpCircle, Loader2, Search, Sparkles } from "lucide-react";
import { askFaqAction } from "@/lib/actions/faq-actions";
import { FaqCategory, FaqEntry } from "@/lib/faq-content";
import { Input } from "@/components/ui/Form";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Gedeelde weergave voor de Help & FAQ-pagina's van organisatoren
 * (app/help/page.tsx) en leveranciers (app/supplier/(portal)/help/page.tsx) —
 * spec-item aug. 2026, verzoek Cem: "een volledig zoekbare FAQ / kennisbank...
 * apart voor organisatoren en leveranciers... bovenin VyrAI zodat de AI
 * antwoord kan geven". Eén component, twee keer aangeroepen met andere
 * inhoud (`categories`) en `audience` — zo blijft de vormgeving gegarandeerd
 * gelijk voor beide doelgroepen, en hoeft een layoutwijziging maar op één
 * plek te gebeuren.
 *
 * Twee manieren om iets te vinden, allebei client-side (geen paginaherlaad):
 * 1. Los zoekveld — filtert direct alle vraag/antwoord-items op de
 *    ingetypte tekst, ongeacht categorie.
 * 2. "Vraag het VyrAI" bovenaan — vrije-tekstvraag, beantwoord door
 *    lib/actions/faq-actions.ts (AI gegrond op precies deze kennisbank, met
 *    een simpele trefwoord-fallback zonder AI-sleutel — nooit een dode
 *    knop, zelfde principe als de andere VyrAI-widgets in dit project).
 */
export function FaqPage({
  audience,
  title,
  intro,
  categories,
  suggestions,
}: {
  audience: "organizer" | "supplier";
  title: string;
  intro: string;
  categories: FaqCategory[];
  suggestions: string[];
}) {
  const [query, setQuery] = useState("");
  const [thread, setThread] = useState<{ q: string; a: string }[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) return null; // null = "geen zoekopdracht actief", toon de normale categorie-indeling
    const words = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches: FaqEntry[] = [];
    for (const category of categories) {
      for (const entry of category.entries) {
        const haystack = `${entry.question} ${entry.answer}`.toLowerCase();
        if (words.every((w) => haystack.includes(w))) matches.push(entry);
      }
    }
    return matches;
  }, [normalizedQuery, categories]);

  function ask(question: string) {
    if (!question.trim() || pending) return;
    setInput("");
    startTransition(async () => {
      const res = await askFaqAction(question, audience);
      setThread((t) => [...t, { q: question, a: res.answer }]);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <div className="flex size-10 items-center justify-center rounded-full bg-sage-50 text-sage">
          <HelpCircle className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl text-ink sm:text-3xl">{title}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{intro}</p>
        </div>
      </div>

      {/* "Vraag het VyrAI" — bewust bovenaan, zoals Cem vroeg. */}
      <Card className="mt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
            <Sparkles className="motion-icon-twinkle size-4.5" />
          </div>
          <div>
            <p className="font-display text-lg text-ink">Vraag het VyrAI</p>
            <p className="text-xs text-ink-faint">Stel je vraag in gewone taal — het antwoord is gebaseerd op deze kennisbank</p>
          </div>
        </div>

        {thread.length === 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
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
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 no-scrollbar">
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
            placeholder="Typ je vraag…"
            className="flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            aria-label="Versturen"
            className="icon-pop flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
      </Card>

      {/* Los zoekveld — filtert de hele kennisbank, los van het AI-veld hierboven. */}
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Zoek in de kennisbank…" className="pl-11" />
      </div>

      <div className="mt-6">
        {filtered !== null ? (
          filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-paper-dim px-4 py-6 text-center text-sm text-ink-faint">
              Geen resultaten voor &ldquo;{query}&rdquo;. Probeer andere woorden, of stel je vraag hierboven aan VyrAI.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <FaqItem key={entry.id} entry={entry} defaultOpen />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category.id}>
                <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">{category.label}</h2>
                <div className="mt-3 space-y-2">
                  {category.entries.map((entry) => (
                    <FaqItem key={entry.id} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FaqItem({ entry, defaultOpen = false }: { entry: FaqEntry; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-line-soft bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-ink">{entry.question}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <p className="px-4 pb-4 text-sm leading-relaxed text-ink-soft">{entry.answer}</p>}
    </div>
  );
}
