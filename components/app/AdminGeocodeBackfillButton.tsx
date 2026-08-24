"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin } from "lucide-react";
import { backfillSupplierCoordinatesAction } from "@/lib/actions/admin-actions";

/**
 * Eenmalige inhaalslag-knop voor "Locatie op een kaart" (zie
 * backfillSupplierCoordinatesAction in lib/actions/admin-actions.ts) —
 * verwerkt telkens een klein batchje leveranciers zonder coördinaten.
 * `remaining` staat als prop mee vanaf de server, zodat de knop meteen
 * verdwijnt zodra iedereen een marker heeft — geen aparte databasequery
 * vanuit de client nodig.
 */
export function AdminGeocodeBackfillButton({ initialRemaining }: { initialRemaining: number }) {
  const [remaining, setRemaining] = useState(initialRemaining);
  const [lastResult, setLastResult] = useState<{ geocoded: number; processed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (remaining <= 0 && !lastResult) return null;

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await backfillSupplierCoordinatesAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRemaining(result.remaining ?? 0);
      setLastResult({ geocoded: result.geocoded ?? 0, processed: result.processed ?? 0 });
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line-soft bg-paper-dim px-3.5 py-2.5 text-sm">
      <MapPin className="size-4 shrink-0 text-ink-faint" />
      <span className="text-ink-soft">
        {remaining > 0
          ? `${remaining} leverancier${remaining !== 1 ? "s" : ""} nog zonder locatie op de kaart.`
          : "Alle leveranciers zijn verwerkt."}
        {lastResult && ` Laatste batch: ${lastResult.geocoded}/${lastResult.processed} gelukt.`}
      </span>
      {remaining > 0 && (
        <button
          type="button"
          disabled={pending}
          onClick={run}
          className="chip-hover ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-clay disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
          Volgende batch verwerken
        </button>
      )}
      {error && <p className="w-full text-xs text-danger">{error}</p>}
    </div>
  );
}
