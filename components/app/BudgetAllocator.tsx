"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RotateCcw } from "lucide-react";
import { updateRequirementBudgetsAction } from "@/lib/actions/event-actions";
import { formatCurrency } from "@/lib/config";
import { AllocatorItem, redistributeSlide } from "@/lib/budget-allocator";

export type { AllocatorItem };

/**
 * Kleurencyclus voor de segmenten/bolletjes — het bestaande kleurenpalet
 * (globals.css) is bewust klein (merkkleuren, geen "categorie-kleuren"), dus
 * we hergebruiken dat cyclisch i.p.v. nieuwe kleuren te verzinnen die niet
 * bij de rest van Vyra passen.
 */
const SEGMENT_COLORS = [
  "var(--color-clay)",
  "var(--color-ochre)",
  "var(--color-sage)",
  "var(--color-danger)",
  "var(--color-clay-dark)",
  "var(--color-ochre-50)",
  "var(--color-sage-dark)",
];

/**
 * De schuiven bovenaan de planpagina (gemeld aug. 2026: "misschien bovenin
 * meteen bij het tabje plan de parameter met een verdeling van de kosten en
 * regelaars/schuiven die men zelf kan veranderen"). Twee gedragingen:
 *
 * - Is het totaalbudget van de organisator bekend: de schuiven zijn aan
 *   elkaar gekoppeld en tellen altijd exact op tot dat budget — meer geven
 *   aan de ene categorie haalt automatisch, naar verhouding, weg bij de
 *   andere(n). Dit is precies het "budget verdelen i.p.v. budget negeren"-
 *   gedrag dat ontbrak (zie de losstaande bugfix in lib/ai/planning.ts).
 * - Is het totaalbudget onbekend: de schuiven staan los van elkaar (er is
 *   niets om ze aan te binden), gewoon losse richtbedragen per categorie.
 *
 * Slaat op met een korte debounce ná het slepen (niet bij elke pixel), en
 * biedt een "AI-voorstel"-knop om alles weer terug te zetten naar wat er
 * oorspronkelijk gegenereerd was.
 */
export function BudgetAllocator({
  eventId,
  items: initialItems,
  totalBudgetCents,
}: {
  eventId: string;
  /** Alleen geselecteerde categorieën mét een bekende schatting — zie app/events/[id]/plan/page.tsx. */
  items: AllocatorItem[];
  totalBudgetCents: number | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [saving, startSaveTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedCentsRef = useRef(initialItems.map((i) => i.cents));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const hasFixedTotal = totalBudgetCents != null && totalBudgetCents > 0;
  const total = items.reduce((sum, it) => sum + it.cents, 0);
  const changedFromAi = items.some((it, i) => it.cents !== initialItems[i]?.cents);

  function scheduleSave(next: AllocatorItem[]) {
    setItems(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const changed = next.some((it, i) => it.cents !== savedCentsRef.current[i]);
      if (!changed) return;
      startSaveTransition(async () => {
        await updateRequirementBudgetsAction(
          eventId,
          next.map((it) => ({ categoryId: it.categoryId, estimatedBudgetCents: it.cents }))
        );
        savedCentsRef.current = next.map((it) => it.cents);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1600);
        // De categoriekaarten verderop op deze pagina (buiten dit component)
        // tonen elk hun eigen "≈ €X"-schatting, rechtstreeks server-
        // gerenderd uit dezelfde requirements — zonder refresh() zouden die
        // nog het oude AI-bedrag tonen totdat de pagina opnieuw geladen
        // wordt. Ververst alleen de servergegevens, dit component behoudt
        // gewoon zijn eigen (al bijgewerkte) state.
        router.refresh();
      });
    }, 500);
  }

  function handleSlide(index: number, rawValue: number) {
    scheduleSave(redistributeSlide(items, index, rawValue, hasFixedTotal));
  }

  function resetToAiSuggestion() {
    scheduleSave(initialItems);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Budgetverdeling</p>
          <p className="mt-0.5 text-xs text-white/60">
            {hasFixedTotal
              ? "Sleep om je budget zelf over de categorieën te verdelen — de andere schuiven passen zich vanzelf aan."
              : "Je hebt nog geen totaalbudget opgegeven, dus dit zijn losse richtbedragen per categorie die je zelf kunt aanpassen."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70">
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {!saving && justSaved && (
            <span className="flex items-center gap-1">
              <Check className="size-3.5" /> opgeslagen
            </span>
          )}
          {changedFromAi && !saving && (
            <button
              type="button"
              onClick={resetToAiSuggestion}
              className="flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 hover:bg-white/10"
            >
              <RotateCcw className="size-3" /> AI-voorstel terugzetten
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/10">
        {items.map((it, i) => (
          <div
            key={it.categoryId}
            style={{
              flexBasis: `${total > 0 ? (it.cents / total) * 100 : 0}%`,
              backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              transition: "flex-basis 150ms ease-out",
            }}
          />
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {items.map((it, i) => {
          const max = hasFixedTotal ? totalBudgetCents! : Math.max(it.cents * 3, 100_000);
          return (
            <div key={it.categoryId}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white/80">
                  <span className="size-2 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                  {it.label}
                </span>
                <span className="font-medium text-white">{formatCurrency(it.cents)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={max}
                step={100}
                value={it.cents}
                onChange={(e) => handleSlide(i, Number(e.target.value))}
                className="h-6 w-full cursor-pointer accent-white"
                aria-label={`Budget voor ${it.label}`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/60">
        <span>Totaal verdeeld</span>
        <span className="font-medium text-white">
          {formatCurrency(total)}
          {hasFixedTotal && ` van ${formatCurrency(totalBudgetCents!)} budget`}
        </span>
      </div>
    </div>
  );
}
