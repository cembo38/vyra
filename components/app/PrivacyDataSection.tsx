"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Clock, Download, Loader2, Shield, Trash2 } from "lucide-react";
import { requestAccountDeletionAction } from "@/lib/actions/account-actions";
import { Textarea } from "@/components/ui/Form";
import { AccountDeletionRequest } from "@/lib/types";
import { formatDateNL } from "@/lib/utils";

/**
 * "Zelfbedienings AVG-export/verwijderen" (livegang-audit) — gedeeld tussen
 * /profile (organisator) en /supplier/profile (leverancier), vandaar een
 * los component i.p.v. de logica in beide pagina's te dupliceren.
 */
export function PrivacyDataSection({ pendingDeletionRequest }: { pendingDeletionRequest: AccountDeletionRequest | null }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletionAction(reason);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setSubmitted(true);
      setConfirmOpen(false);
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2 text-ink">
        <Shield className="size-4.5 text-sage" />
        <h2 className="font-display text-lg">Privacy &amp; gegevens</h2>
      </div>
      <p className="mt-1 text-sm text-ink-soft">Beheer je eigen gegevens op Vyra, conform de AVG.</p>

      <a
        href="/api/account/export"
        className="chip-hover mt-4 flex items-center gap-2 rounded-xl border border-line-soft px-3.5 py-2.5 text-sm text-ink hover:border-sage/50"
      >
        <Download className="size-4 shrink-0 text-sage" />
        <span className="flex-1">Download mijn gegevens</span>
      </a>

      <div className="mt-3 border-t border-line-soft pt-4">
        {submitted || pendingDeletionRequest ? (
          <p className="flex items-start gap-2 rounded-xl bg-ochre-50 px-3.5 py-2.5 text-sm text-ink-soft">
            <Clock className="mt-0.5 size-4 shrink-0 text-ochre" />
            Je verwijderingsverzoek is ontvangen{pendingDeletionRequest ? ` op ${formatDateNL(pendingDeletionRequest.createdAt)}` : ""} en wordt binnenkort beoordeeld. Je account blijft tot die tijd gewoon actief.
          </p>
        ) : !confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="chip-hover flex items-center gap-1.5 text-sm font-medium text-danger hover:underline"
          >
            <Trash2 className="size-3.5" /> Account laten verwijderen
          </button>
        ) : (
          <div className="space-y-2.5 rounded-xl border border-danger/30 bg-danger-50/30 p-3.5">
            <p className="flex items-start gap-1.5 text-xs text-ink-soft">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              Dit dient een verzoek in om je account en gegevens permanent te laten verwijderen. Cem beoordeelt dit persoonlijk (bijv. bij nog lopende boekingen) voordat het daadwerkelijk gebeurt.
            </p>
            <Textarea rows={2} placeholder="Reden (optioneel)" value={reason} onChange={(e) => setReason(e.target.value)} />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={submit}
                className="lift-hover flex items-center gap-1.5 rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending && <Loader2 className="size-3.5 animate-spin" />} Verzoek versturen
              </button>
              <button type="button" onClick={() => setConfirmOpen(false)} className="text-sm text-ink-faint hover:text-ink">
                Annuleren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
