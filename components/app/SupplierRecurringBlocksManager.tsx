"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat } from "lucide-react";
import { toggleSupplierRecurringBlockAction } from "@/lib/actions/supplier-actions";

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/**
 * Structurele weekdag-blokkade ("ik werk nooit op maandag") — spec-item
 * #128, los van de eenmalige datums in `SupplierBlockedDatesManager`
 * hieronder op dezelfde pagina. Zelfde toggle-chip-patroon als elders in de
 * app (bv. categorie-filters): één druk aan/uit, geen apart "opslaan".
 * `weekday` 0=maandag..6=zondag, matcht 1-op-1 de volgorde van
 * `WEEKDAY_LABELS` hier — geen omrekening nodig in deze component.
 */
export function SupplierRecurringBlocksManager({ initialWeekdays }: { initialWeekdays: number[] }) {
  const [weekdays, setWeekdays] = useState(new Set(initialWeekdays));
  const [pendingDay, setPendingDay] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle(day: number) {
    const wasBlocked = weekdays.has(day);
    setError(null);
    setPendingDay(day);
    startTransition(async () => {
      const result = await toggleSupplierRecurringBlockAction(day, !wasBlocked);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        setPendingDay(null);
        return;
      }
      setWeekdays((prev) => {
        const next = new Set(prev);
        if (wasBlocked) next.delete(day);
        else next.add(day);
        return next;
      });
      setPendingDay(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-ink">
        <Repeat className="size-4.5 text-ink-faint" />
        <h2 className="font-display text-lg">Vaste werkdagen</h2>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Zet een weekdag uit als je daar structureel niet beschikbaar bent (bv. een vaste rustdag) — dit blijft van kracht totdat je &apos;m weer aanzet, en telt net als eenmalige blokkades mee bij het matchen van nieuwe aanvragen.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {WEEKDAY_LABELS.map((label, day) => {
          const blocked = weekdays.has(day);
          const isPending = pendingDay === day;
          return (
            <button
              key={label}
              type="button"
              disabled={isPending}
              onClick={() => toggle(day)}
              aria-pressed={blocked}
              className={`chip-hover inline-flex min-h-11 min-w-14 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                blocked ? "border-ink-faint/40 bg-paper-dim text-ink-soft" : "border-line bg-white text-ink hover:border-sage/50"
              }`}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              {label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
