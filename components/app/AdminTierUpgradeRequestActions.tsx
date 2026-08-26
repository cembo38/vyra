"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/Form";
import { approveTierUpgradeRequestAction, declineTierUpgradeRequestAction, type ActionResult } from "@/lib/actions/admin-actions";

/**
 * Zelfde inline-actie-patroon als AdminDisputeActions, maar met een
 * OPTIONELE toelichting bij goedkeuren (het abonnement wordt sowieso
 * omgezet, een toelichting is daar minder essentieel dan bij een geschil)
 * en een VERPLICHTE toelichting bij afwijzen — de server action
 * (declineTierUpgradeRequestAction) valideert dit ook zelf nog eens.
 */
export function AdminTierUpgradeRequestActions({ requestId }: { requestId: string }) {
  const [response, setResponse] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<ActionResult>, requireResponse: boolean) {
    if (requireResponse && !response.trim()) {
      setError("Geef een toelichting op je afwijzing — die ziet de leverancier.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("adminResponse", response.trim());
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) setResponse("");
      else setError(result.error);
    });
  }

  return (
    <div className="mt-2.5 space-y-2">
      <Textarea rows={2} placeholder="Toelichting (optioneel bij goedkeuren, verplicht bij afwijzen)..." value={response} onChange={(e) => setResponse(e.target.value)} />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(approveTierUpgradeRequestAction, false)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-success min-h-9 px-3 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Goedkeuren
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(declineTierUpgradeRequestAction, true)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          Afwijzen
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
