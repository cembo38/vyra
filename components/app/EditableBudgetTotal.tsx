"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Wallet, X } from "lucide-react";
import { updateBudgetTotalAction } from "@/lib/actions/event-actions";
import { formatCurrency } from "@/lib/config";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Cem (aug. 2026): "maak die 500 aanpasbaar. zodat iemand ieder gewenst
 * moment kan wijzigen" — de "Totaal budget"-tegel op de budgetpagina was tot
 * nu toe puur weergave (alleen instelbaar via het AI-interview). Zelfde
 * inline-bewerk-patroon als BudgetAllocator.tsx ernaast: direct opslaan
 * (geen apart formulier/modal), en na het opslaan `router.refresh()` zodat
 * de rest van de pagina (percentage-boven-budget, de verdeel-schuiven
 * ernaast, het VyrAI-advies) meteen meerekent met het nieuwe bedrag.
 */
export function EditableBudgetTotal({ eventId, totalCents }: { eventId: string; totalCents: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Math.round(totalCents / 100)));
  const [saving, startSaveTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    setValue(String(Math.round(totalCents / 100)));
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    const euros = Number(value.replace(",", "."));
    if (!Number.isFinite(euros) || euros < 0) return;
    startSaveTransition(async () => {
      await updateBudgetTotalAction(eventId, Math.round(euros * 100));
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
          <Wallet className="size-4" />
          Totaal budget
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-display text-2xl text-ink">€</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            className="w-24 rounded-lg border border-line bg-white px-2 py-1 font-display text-2xl text-ink focus:border-clay focus:outline-none"
            aria-label="Totaal budget in euro's"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            aria-label="Opslaan"
            className="icon-pop flex size-8 items-center justify-center rounded-full text-success hover:bg-success-50 disabled:opacity-50"
          >
            {saving ? <VyraMarkSpinner className="text-base" /> : <Check className="size-4" />}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Annuleren"
            className="icon-pop flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
        <Wallet className="size-4" />
        Totaal budget
      </p>
      <button
        type="button"
        onClick={startEditing}
        className="group mt-1 flex items-center gap-1.5 rounded-lg -ml-1 px-1 py-0.5 text-left hover:bg-paper-dim"
      >
        <span className="font-display text-2xl text-ink">{formatCurrency(totalCents)}</span>
        <Pencil className="size-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </div>
  );
}
