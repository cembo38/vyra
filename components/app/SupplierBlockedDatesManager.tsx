"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, X } from "lucide-react";
import { blockSupplierDateRangeAction, toggleSupplierBlockedDateAction } from "@/lib/actions/supplier-actions";

function formatDateNLShort(dateKey: string) {
  return new Date(dateKey + "T00:00:00").toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Laat een leverancier zelf datums blokkeren (vakantie, elders volgeboekt)
 * — telt vanaf nu mee bij het matchen van nieuwe aanvragen op die datum
 * (zie `findRealMatchingSuppliers` in lib/data/store.ts). "Tot" is
 * optioneel — leeg laten blokkeert alleen "Van" (één dag), net als voorheen.
 * Bewust een van/tot-periode i.p.v. drag-select op de maandgrid hierboven:
 * een sleepgebaar is op een kleine grid lastig precies te bedienen (zeker
 * op een telefoon, waar die grid sowieso al verborgen is) — een periode in
 * één keer instellen dekt de vakantie-use case net zo goed, betrouwbaarder,
 * en werkt op elk schermformaat.
 */
export function SupplierBlockedDatesManager({ initialBlockedDates }: { initialBlockedDates: string[] }) {
  const [dates, setDates] = useState(initialBlockedDates);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  function addRange() {
    if (!fromDate) return;
    setError(null);
    startTransition(async () => {
      const result = await blockSupplierDateRangeAction(fromDate, toDate || fromDate);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setDates((prev) => [...new Set([...prev, ...(result.dates ?? [])])].sort());
      setFromDate("");
      setToDate("");
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
        Blokkeer een periode waarin je geen nieuwe aanvragen kunt aannemen (vakantie, elders volgeboekt) — &quot;Tot&quot; leeg laten blokkeert alleen &quot;Van&quot;.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="block-date-from" className="text-xs font-medium text-ink-faint">Van</label>
          {/* text-base (16px) i.p.v. de eerdere 14px: onder 16px triggert
              iOS Safari een automatische in-zoom bij focus — zelfde fix als
              fieldBase in components/ui/Form.tsx, maar deze twee datumvelden
              gebruiken bewust ad-hoc opmaak (naast elkaar + knop) i.p.v. de
              gedeelde <Input/>. */}
          <input
            id="block-date-from"
            type="date"
            min={today}
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              if (toDate && toDate < e.target.value) setToDate(e.target.value);
            }}
            className="rounded-xl border border-line px-4 py-3 text-base text-ink outline-none focus:border-sage"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="block-date-to" className="text-xs font-medium text-ink-faint">Tot <span className="normal-case text-ink-faint/70">(optioneel)</span></label>
          <input
            id="block-date-to"
            type="date"
            min={fromDate || today}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-line px-4 py-3 text-base text-ink outline-none focus:border-sage"
          />
        </div>
        <button
          type="button"
          disabled={!fromDate || pending}
          onClick={addRange}
          className="chip-hover inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
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
