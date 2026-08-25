"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { generateSupplierBriefingAction } from "@/lib/actions/supplier-assistant-actions";

/**
 * Dagelijkse prioriteitenbriefing (Premium+, spec-item #57) — verschijnt
 * alleen op het dashboard van Premium/Enterprise-leveranciers (en tijdens
 * de proefperiode). `initialNarrative` komt uit de server-gerenderde cache
 * van vandaag (getCachedSupplierBriefing) — is die er nog niet, dan toont
 * dit component een knop om 'm (eenmalig per dag) te genereren.
 */
export function SupplierBriefingCard({ initialNarrative }: { initialNarrative: string | null }) {
  const [narrative, setNarrative] = useState(initialNarrative);
  const [pending, startTransition] = useTransition();

  function generate() {
    if (pending) return;
    startTransition(async () => {
      const res = await generateSupplierBriefingAction();
      setNarrative(res.narrative);
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 [box-shadow:var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-full bg-sage-50 text-sage">
          <Sparkles className="motion-icon-twinkle size-4.5" />
        </div>
        <div>
          <p className="font-display text-lg text-ink">VyrAI-ochtendbriefing</p>
          <p className="text-xs text-ink-faint">Wat vandaag als eerst je aandacht verdient</p>
        </div>
      </div>

      {narrative ? (
        <p className="mt-3 text-sm text-ink-soft">{narrative}</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-faint">Nog geen briefing gegenereerd vandaag.</p>
          <button
            onClick={generate}
            disabled={pending}
            className="chip-hover mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-paper disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Genereer briefing
          </button>
        </div>
      )}
    </div>
  );
}
