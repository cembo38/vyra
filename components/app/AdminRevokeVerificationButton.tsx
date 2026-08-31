"use client";

import { useState, useTransition } from "react";
import { ShieldOff } from "lucide-react";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { revokeSupplierVerificationAction } from "@/lib/actions/admin-actions";

/**
 * Tegenhanger van AdminSupplierVerificationActions (goedkeuren/afwijzen van
 * een AANVRAAG) — dit is voor een leverancier die al geverifieerd IS. Tot nu
 * toe was een goedkeuring definitief: er was geen manier om een badge terug
 * te trekken als later bleek dat de KVK-gegevens niet klopten of er misbruik
 * werd geconstateerd. Reversibel (de leverancier kan opnieuw verificatie
 * aanvragen vanuit zijn profiel), dus zelfde lichte inline-bevestiging als
 * AdminUserActions' blokkeren-knop i.p.v. een zware bevestigingsstap.
 */
export function AdminRevokeVerificationButton({ supplierId }: { supplierId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              const formData = new FormData();
              formData.set("supplierId", supplierId);
              startTransition(async () => {
                const result = await revokeSupplierVerificationAction(formData);
                if (result.ok) setConfirming(false);
                else setError(result.error);
              });
            }}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-danger min-h-9 px-3 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? <VyraMarkSpinner className="text-sm" /> : <ShieldOff className="size-3.5" />}
            Ja, intrekken
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="text-xs text-ink-faint hover:text-ink">
            Annuleren
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-faint hover:border-danger/50 hover:text-danger"
    >
      <ShieldOff className="size-3.5" /> Verificatie intrekken
    </button>
  );
}
