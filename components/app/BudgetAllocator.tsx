"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Lock, RotateCcw, Unlock } from "lucide-react";
import { updateRequirementBudgetsAction } from "@/lib/actions/event-actions";
import { formatCurrency } from "@/lib/config";
import { cn } from "@/lib/utils";
import { AllocatorItem, remainingCents, sanitizeItems, slideItem } from "@/lib/budget-allocator";

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
 * - Is het totaalbudget van de organisator bekend: elke schuif haalt bij het
 *   verhogen uit een gedeelde "nog te verdelen"-pot en geeft bij het
 *   verlagen daaraan terug — "envelope budgeting", zie lib/budget-allocator.ts.
 *   Andere categorieën veranderen daarbij nooit mee.
 * - Is het totaalbudget onbekend: de schuiven staan los van elkaar (er is
 *   niets om ze aan te binden), gewoon losse richtbedragen per categorie.
 *
 * Elke categorie kan met het hangslotje "vastgezet" worden — puur een
 * lichte bescherming tegen jezelf per ongeluk verslepen (aug. 2026, Cem: "je
 * per categorie de bandbreedte kunt vastzetten... locken"), geen
 * rekenkundige noodzaak meer sinds het envelope-model hierboven.
 *
 * Slaat op met een korte debounce ná het slepen (niet bij elke pixel), en
 * biedt een "AI-voorstel"-knop om alles weer terug te zetten naar wat er
 * oorspronkelijk gegenereerd was (vastgezette categorieën blijven daarbij
 * met rust).
 */
/**
 * Twee kleurthema's: "dark" voor op de donkere AI-eventplan-hero
 * (app/events/[id]/plan/page.tsx), "light" voor op de lichte budgetpagina
 * (app/events/[id]/budget/page.tsx, gemeld aug. 2026 — Cem wilde de
 * schuiven ook daar zien, niet alleen op de planpagina).
 */
const THEME = {
  dark: {
    heading: "text-white",
    subtext: "text-white/60",
    trackBg: "bg-white/10",
    itemLabel: "text-white/80",
    amount: "text-white",
    controlText: "text-white/70",
    resetBtn: "border border-white/20 hover:bg-white/10",
    footerBorder: "border-white/10",
    footerLabel: "text-white/60",
    lockBtn: "text-white/50 hover:bg-white/10 hover:text-white",
    lockBtnActive: "bg-white/15 text-white",
    potPositive: "bg-white/10 text-white",
    potNegative: "bg-danger/20 text-white",
    remainingSegment: "rgba(255, 255, 255, 0.12)",
    // Kleuren voor de .budget-slider-track/thumb (globals.css) — een kale
    // <input type="range"> valt terug op de systeem-eigen trackkleur van de
    // browser i.p.v. hierop aan te sluiten, vandaar expliciet.
    sliderTrackColor: "rgba(255, 255, 255, 0.15)",
    sliderThumbColor: "#ffffff",
  },
  light: {
    heading: "text-ink",
    subtext: "text-ink-faint",
    trackBg: "bg-paper-dim",
    itemLabel: "text-ink-soft",
    amount: "text-ink",
    controlText: "text-ink-faint",
    resetBtn: "border border-line hover:bg-paper-dim",
    footerBorder: "border-line-soft",
    footerLabel: "text-ink-faint",
    lockBtn: "text-ink-faint hover:bg-paper-dim hover:text-ink",
    lockBtnActive: "bg-paper-dim text-ink",
    potPositive: "bg-sage-50 text-sage-dark",
    potNegative: "bg-danger-50 text-danger",
    remainingSegment: "var(--color-line)",
    sliderTrackColor: "var(--color-line-soft)",
    sliderThumbColor: "var(--color-clay)",
  },
} as const;

export function BudgetAllocator({
  eventId,
  items: initialItems,
  totalBudgetCents,
  variant = "dark",
}: {
  eventId: string;
  /** Alleen geselecteerde categorieën mét een bekende schatting — zie app/events/[id]/plan/page.tsx en app/events/[id]/budget/page.tsx. */
  items: AllocatorItem[];
  totalBudgetCents: number | null;
  variant?: "dark" | "light";
}) {
  const t = THEME[variant];
  // sanitizeItems: een categorie kan hier nog een oud, absurd groot bedrag
  // hebben staan (van vóór de AI-vangnetfix, zie MAX_SANE_CATEGORY_CENTS in
  // lib/budget-allocator.ts) — dat wordt hier bij binnenkomst al onschadelijk
  // gemaakt, vóórdat het ooit een schuif of bedrag op het scherm bereikt.
  const sanitizedInitialItems = sanitizeItems(initialItems);
  const [items, setItems] = useState(sanitizedInitialItems);
  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [saving, startSaveTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const savedCentsRef = useRef(sanitizedInitialItems.map((i) => i.cents));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const hasFixedTotal = totalBudgetCents != null && totalBudgetCents > 0;
  const total = items.reduce((sum, it) => sum + it.cents, 0);
  const remaining = remainingCents(items, totalBudgetCents);
  const changedFromAi = items.some((it, i) => it.cents !== sanitizedInitialItems[i]?.cents);
  // Waar de gekleurde segmenten hun percentage van de balk tegen afzetten:
  // mét vast totaalbudget tegen dát totaal (zodat er ruimte overblijft voor
  // het grijze "nog te verdelen"-stukje hieronder), anders gewoon tegen de
  // som van de schuiven zelf.
  const barDenominator = hasFixedTotal ? totalBudgetCents! : total;

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
    if (lockedIds.has(items[index].categoryId)) return; // defensief — de schuif zelf staat al op disabled
    scheduleSave(slideItem(items, index, rawValue, totalBudgetCents));
  }

  function toggleLock(categoryId: string) {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function resetToAiSuggestion() {
    // Vastgezette categorieën blijven met rust — "vastzetten" zou weinig
    // voorstellen als een reset ze alsnog zou terugzetten.
    scheduleSave(items.map((it, i) => (lockedIds.has(it.categoryId) ? it : sanitizedInitialItems[i])));
  }

  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${t.heading}`}>Budgetverdeling</p>
          <p className={`mt-0.5 text-xs ${t.subtext}`}>
            {hasFixedTotal
              ? "Sleep om budget aan een categorie toe te wijzen — dat komt uit de \"nog te verdelen\"-pot hieronder, andere categorieën veranderen niet mee. Zet een categorie vast met het hangslotje om 'm tegen zelf per ongeluk verslepen te beschermen."
              : "Je hebt nog geen totaalbudget opgegeven, dus dit zijn losse richtbedragen per categorie die je zelf kunt aanpassen."}
          </p>
        </div>
        <div className={`flex items-center gap-2 text-xs ${t.controlText}`}>
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {!saving && justSaved && (
            <span className="flex items-center gap-1">
              <Check className="size-3.5" /> opgeslagen
            </span>
          )}
          {changedFromAi && !saving && (
            <button type="button" onClick={resetToAiSuggestion} className={`flex items-center gap-1 rounded-full px-2.5 py-1 ${t.resetBtn}`}>
              <RotateCcw className="size-3" /> AI-voorstel terugzetten
            </button>
          )}
        </div>
      </div>

      <div className={`mt-4 flex h-2.5 overflow-hidden rounded-full ${t.trackBg}`}>
        {items.map((it, i) => (
          <div
            key={it.categoryId}
            style={{
              flexBasis: `${barDenominator > 0 ? (it.cents / barDenominator) * 100 : 0}%`,
              backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              transition: "flex-basis 150ms ease-out",
            }}
          />
        ))}
        {/* Het "1 verticale lijn"-idee dat Cem voorstelde (aug. 2026): de
            grens tussen de laatste gekleurde categorie en dit grijze,
            onverdeelde stuk IS die lijn — in één oogopslag zichtbaar hoeveel
            van het budget nog geen bestemming heeft, zonder dat je iets
            hoeft te slepen om dat te zien. */}
        {hasFixedTotal && remaining != null && remaining > 0 && (
          <div
            style={{
              flexBasis: `${(remaining / barDenominator) * 100}%`,
              backgroundColor: t.remainingSegment,
              transition: "flex-basis 150ms ease-out",
            }}
          />
        )}
      </div>

      {hasFixedTotal && remaining != null && (
        <div
          className={cn(
            "mt-3 flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium",
            remaining < 0 ? t.potNegative : t.potPositive
          )}
        >
          <span>{remaining < 0 ? "Te veel toegewezen" : "Nog te verdelen"}</span>
          <span>{formatCurrency(Math.abs(remaining))}</span>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {items.map((it, i) => {
          const locked = lockedIds.has(it.categoryId);
          // BUGFIX (gemeld door Cem, aug. 2026: "shuifjes doen niks"): de
          // eerdere versie zette de bovengrens van de schuif op "huidig
          // bedrag + wat de pot nog heeft" — zodra de pot leeg of negatief
          // was (bv. dit evenement zit al boven budget), werd dat exact
          // gelijk aan het huidige bedrag. Elke schuif stond dan altijd op
          // 100%, ongeacht het werkelijke bedrag, en kon met geen mogelijkheid
          // meer bewegen (ook niet zichtbaar naar links, want min/max/value
          // vielen bijna samen). De daadwerkelijke grens (nooit meer opeisen
          // dan de pot toestaat) wordt toch al hard afgedwongen in
          // `slideItem` zelf zodra je loslaat — deze `max` is puur hoe ver je
          // de schuif visueel kunt verslepen, dus die mag gewoon altijd ruim
          // zijn. Sleep je voorbij wat er echt beschikbaar is, dan springt
          // het bedrag bij loslaten terug naar wat wél kon — normaal
          // schuifgedrag, geen bug.
          const max = Math.max(it.cents * 3, 100_000);
          return (
            <div key={it.categoryId}>
              {/* min-w-0 + truncate op beide kanten: extra vangnet naast de
                  MAX_SANE_CATEGORY_CENTS-klem hierboven — een label of bedrag
                  kan zo nooit meer de hele pagina breder duwen dan het scherm
                  (zie de toelichting bij `max` hierboven voor de aanleiding). */}
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className={`flex min-w-0 items-center gap-1.5 ${t.itemLabel}`}>
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                  <span className="truncate">{it.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className={`truncate font-medium ${t.amount}`}>{formatCurrency(it.cents)}</span>
                  <button
                    type="button"
                    onClick={() => toggleLock(it.categoryId)}
                    aria-pressed={locked}
                    aria-label={locked ? `${it.label} loskoppelen` : `${it.label} vastzetten`}
                    className={cn("flex size-6 items-center justify-center rounded-full transition-colors", locked ? t.lockBtnActive : t.lockBtn)}
                  >
                    {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                  </button>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={max}
                step={100}
                value={it.cents}
                disabled={locked}
                onChange={(e) => handleSlide(i, Number(e.target.value))}
                className={cn("budget-slider h-6 w-full", locked ? "cursor-not-allowed opacity-40" : "cursor-pointer")}
                style={{ "--slider-track-color": t.sliderTrackColor, "--slider-thumb-color": t.sliderThumbColor } as CSSProperties}
                aria-label={`Budget voor ${it.label}`}
              />
            </div>
          );
        })}
      </div>

      <div className={`mt-3 flex items-center justify-between border-t pt-3 text-xs ${t.footerBorder} ${t.footerLabel}`}>
        <span>Totaal verdeeld</span>
        <span className={`font-medium ${t.amount}`}>
          {formatCurrency(total)}
          {hasFixedTotal && ` van ${formatCurrency(totalBudgetCents!)} budget`}
        </span>
      </div>
    </div>
  );
}
