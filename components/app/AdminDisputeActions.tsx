"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Textarea } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { resolveDisputeAction, dismissDisputeAction, type ActionResult } from "@/lib/actions/admin-actions";

/** Zelfde inline-actie-patroon als `AdminSupplierVerificationActions`, met een verplichte toelichting — die gaat naar beide betrokken partijen. */
export function AdminDisputeActions({ disputeId }: { disputeId: string }) {
  const [response, setResponse] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<ActionResult>) {
    if (!response.trim()) {
      setError("Geef een toelichting op je beslissing — die zien beide partijen.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("disputeId", disputeId);
    formData.set("adminResponse", response.trim());
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) setResponse("");
      else setError(result.error);
    });
  }

  return (
    <div className="mt-2.5 space-y-2">
      {/* Geen text-sm/py-overschrijving meer — dat forceerde 14px tekst,
          wat op iOS Safari een ongewenste in-zoom bij focus triggert (zie
          fieldBase in components/ui/Form.tsx). */}
      <Textarea
        rows={2}
        placeholder="Toelichting op je beslissing (verplicht, zichtbaar voor beide partijen)..."
        value={response}
        onChange={(e) => setResponse(e.target.value)}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(resolveDisputeAction)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-success min-h-9 px-3 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <CheckCircle2 className="size-3.5" />}
          Oplossen
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(dismissDisputeAction)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <X className="size-3.5" />}
          Afwijzen
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
