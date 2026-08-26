"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { Sparkles, ArrowUp, Loader2, Lock } from "lucide-react";
import { askSupplierAssistantAction } from "@/lib/actions/supplier-assistant-actions";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";

const SUGGESTIONS = [
  "Welke aanvraag verdient nu het eerst aandacht?",
  "Hoe sta ik ervoor qua verdiensten?",
  "Hoe doe ik het t.o.v. mijn categorie?",
  "Wat komt er deze maand aan boekingen?",
];

/**
 * VyrAI-assistent voor leveranciers (Pro+, spec-item #57) — het
 * spiegelbeeld van AssistantWidget.tsx (organisatorkant). Bewust dezelfde
 * bubble-thread/suggestiechips-vormgeving, zodat het meteen herkenbaar is
 * als "hetzelfde soort ding" voor wie beide kanten van het platform kent.
 *
 * `enabled=false` (Starter/Groei) toont een compacte teaser i.p.v. het
 * volledige widget — de server action zelf blokkeert sowieso ook nog eens
 * (dubbele bodem, zie checkSupplierAssistantAccess in lib/data/store.ts),
 * maar zo hoeft een leverancier zonder toegang niet eerst een vraag te
 * typen om daarachter te komen.
 *
 * `usage` ("resterende VyrAI-limiet zichtbaar maken", livegang-audit) —
 * tot nu toe ontdekte een leverancier zijn dagelijkse limiet pas ACHTERAF,
 * via de afwijzende tekst na een mislukte poging. `limit: null` = geen
 * dagelijkse limiet (Enterprise/proefperiode) — dan tonen we niets, want
 * er is niets te bewaken.
 */
export function SupplierAssistantWidget({ enabled, usage }: { enabled: boolean; usage: { used: number; limit: number | null } | null }) {
  const [thread, setThread] = useState<{ q: string; a: string; blocked?: boolean }[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const remaining = usage?.limit != null ? Math.max(0, usage.limit - usage.used) : null;
  const limitReached = remaining === 0;

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-paper-dim p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
            <Sparkles className="motion-icon-twinkle size-4.5" />
          </div>
          <div>
            <p className="font-display text-lg text-ink">VyrAI-assistent</p>
            <p className="text-xs text-ink-faint">Jouw persoonlijke assistent voor aanvragen, verdiensten en meer</p>
          </div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-sm text-ink-soft">
          <Lock className="mt-0.5 size-3.5 shrink-0" /> Beschikbaar vanaf het Pro-abonnement.{" "}
          <Link href="/supplier/profile" className="font-medium text-clay hover:underline">Bekijk abonnementen</Link>
        </p>
      </div>
    );
  }

  function ask(question: string) {
    if (!question.trim() || pending) return;
    setInput("");
    startTransition(async () => {
      const res = await askSupplierAssistantAction(question);
      setThread((t) => [...t, { q: question, a: res.answer, blocked: res.blocked }]);
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 [box-shadow:var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
            <Sparkles className="motion-icon-twinkle size-4.5" />
          </div>
          <div>
            <p className="font-display text-lg text-ink">VyrAI-assistent</p>
            <p className="text-xs text-ink-faint">Vraag alles over je aanvragen, boekingen en verdiensten</p>
          </div>
        </div>
        {usage?.limit != null && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${limitReached ? "bg-warning-50 text-warning" : "bg-paper-dim text-ink-faint"}`}>
            {limitReached ? "Daglimiet bereikt" : `${remaining}/${usage.limit} vandaag over`}
          </span>
        )}
      </div>

      {limitReached && (
        <p className="mt-3 rounded-xl bg-warning-50 px-3 py-2 text-xs text-ink-soft">
          Je hebt je {usage!.limit} gratis VyrAI-aanroepen voor vandaag gebruikt (geldt voor chat, conceptantwoorden, offertehulp en meer samen). Morgen kun je weer verder, of upgrade naar Enterprise voor een onbeperkte limiet.
        </p>
      )}

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
              <p className={`w-fit max-w-[90%] rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm ${t.blocked ? "bg-ochre-50 text-ink-soft" : "bg-paper-dim text-ink"}`}>{t.a}</p>
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
          disabled={limitReached}
          placeholder={limitReached ? "Daglimiet bereikt — morgen weer verder" : "Typ of spreek je vraag in…"}
          className="flex-1 bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
        <VoiceInputButton className="size-9" onTranscript={(text) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))} />
        <button
          type="submit"
          disabled={pending || !input.trim() || limitReached}
          aria-label="Versturen"
          className="icon-pop flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
