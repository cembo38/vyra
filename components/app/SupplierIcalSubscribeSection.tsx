"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RefreshCw, Rss } from "lucide-react";
import { regenerateIcalTokenAction } from "@/lib/actions/supplier-actions";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * "Kalenderabonnement" (spec-item #128) — laat een leverancier zijn
 * bevestigde boekingen + eenmalige blokkades laten meelopen in zijn eigen
 * agenda-app (Apple/Google Kalender e.d.) via een .ics-abonnement-URL. Zelfde
 * kopieer-knop-patroon als `ReferralSection`, plus een "vernieuw"-knop die
 * de oude URL direct laat stoppen met werken (bv. na een ongelukje met
 * delen) — geen JS-`confirm()`-dialoog (die blokkeert de hele browser-tab,
 * zie de bekende beperking daarvan), gewoon een korte waarschuwingstekst
 * ernaast.
 */
export function SupplierIcalSubscribeSection({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [copied, setCopied] = useState(false);
  const [regenerated, setRegenerated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API kan falen — de link staat gewoon zichtbaar in het veld.
    }
  }

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regenerateIcalTokenAction();
      if (!result.ok || !result.token) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setUrl((prev) => prev.replace(/\/ical\/[^/]+$/, `/ical/${result.token}`));
      setRegenerated(true);
      setTimeout(() => setRegenerated(false), 2500);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-ink">
        <Rss className="size-4.5 text-ink-faint" />
        <h2 className="font-display text-lg">Kalenderabonnement</h2>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Voeg deze link toe als agenda-abonnement (bv. Apple Kalender: &quot;Voeg agenda toe&quot; → &quot;Op basis van URL&quot;, of Google Kalender: &quot;Via URL&quot;) om je bevestigde boekingen en geblokkeerde datums automatisch in je eigen agenda te zien.
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 truncate rounded-xl border border-line bg-paper-dim px-3 py-2 text-sm text-ink-soft"
        />
        <button
          type="button"
          onClick={copy}
          className="chip-hover flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-medium text-ink hover:border-sage/50"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Gekopieerd" : "Kopiëren"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-xs text-ink-faint">Link gedeeld met iemand anders of ongewenst gebruikt? Vernieuw &apos;m — de oude link stopt dan meteen met werken.</p>
        <button
          type="button"
          disabled={pending}
          onClick={regenerate}
          className="chip-hover inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <RefreshCw className="size-3.5" />}
          {regenerated ? "Vernieuwd" : "Link vernieuwen"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
