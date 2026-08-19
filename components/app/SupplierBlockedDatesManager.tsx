"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, X } from "lucide-react";
import { toggleSupplierBlockedDateAction } from "@/lib/actions/supplier-actions";

function formatDateNLShort(dateKey: string) {
  return new Date(dateKey + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Laat een leverancier zelf datums blokkeren (vakantie, elders volgeboekt)
 * — telt vanaf nu mee bij het matchen van nieuwe aanvragen op die datum
 * (zie `findRealMatchingSuppliers` in lib/data/store.ts). Bewust een los
 * datumveld + lijst i.p.v. klikbare cellen in de maandgrid hierboven: die
 * grid is op mobiel al bewust NIET interactief (cellen van ~50px zijn te
 * dicht om nauwkeurig te tikken, zie de toelichting verderop op deze
 * pagina) — dit werkt op elk schermformaat.
 */
export function SupplierBlockedDatesManager({ initialBlockedDates }: { initialBlockedDates: string[] }) {
  const [dates, setDates] = useState(initialBlockedDates);
  const [newDate, setNewDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  function addDate() {
    if (!newDate) return;
    setError(null);
    startTransition(async () => {
      const result = await toggleSupplierBlockedDateAction(newDate, true);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setDates((prev) => [...new Set([...prev, newDate])].sort());
      setNewDate("");
      router.refresh();
    });
  }

  function removeDate(date: string) {
    setError(null);
    startTransition(async () => {
      const result = await toggleSupplierBlockedDateAction(date, false);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setDates((prev) => prev.filter((d) => d !== date));
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-ink">
        <CalendarOff className="size-4.5 text-ink-faint" />
        <h2 className="font-display text-lg">Niet-beschikbare datums</h2>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Blokkeer datums waarop je geen nieuwe aanvragen kunt aannemen (vakantie, elders volgeboekt) — je krijgt dan geen nieuwe aanvragen meer voor die dag.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="block-date" className="text-xs font-medium text-ink-faint">Datum blokkeren</label>
          <input
            id="block-date"
            type="date"
            min={today}
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-xl border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-sage"
          />
        </div>
        <button
          type="button"
          disabled={!newDate || pending}
          onClick={addDate}
          className="chip-hover inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarOff className="size-3.5" />}
          Blokkeren
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {dates.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {dates.map((date) => (
            <span key={date} className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-paper-dim px-3 py-1.5 text-xs font-medium text-ink-soft">
              {formatDateNLShort(date)}
              <button
                type="button"
                disabled={pending}
                onClick={() => removeDate(date)}
                aria-label={`Blokkering van ${formatDateNLShort(date)} opheffen`}
                className="text-ink-faint hover:text-danger disabled:opacity-40"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
