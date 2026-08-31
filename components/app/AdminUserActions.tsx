"use client";

import { useState, useTransition } from "react";
import { Ban, RotateCcw } from "lucide-react";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { banUserAction, unbanUserAction } from "@/lib/actions/admin-actions";

/**
 * Blokkeren is reversibel (vandaar geen zware "typ de naam ter bevestiging"-
 * stap zoals bij het definitief verwijderen van een evenement) — een lichte
 * inline bevestiging met optionele reden volstaat, zelfde patroon als
 * `CloseEventButton`. De Server Actions geven bij een probleem
 * `{ ok: false, error }` terug (bv. "kan jezelf niet blokkeren") — geen
 * `throw`, want Next.js redigeert de boodschap van een echt gegooide
 * Error in productie naar een onleesbare generieke tekst. Zie de
 * uitleg bij `runAction()` in lib/actions/admin-actions.ts.
 */
export function AdminUserActions({ userId, bannedAt }: { userId: string; bannedAt: string | null }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (bannedAt) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            const formData = new FormData();
            formData.set("userId", userId);
            startTransition(async () => {
              const result = await unbanUserAction(formData);
              if (!result.ok) setError(result.error);
            });
          }}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <RotateCcw className="size-3.5" />}
          Deblokkeren
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reden (optioneel)"
            className="w-36 rounded-lg border border-line px-2 py-1 text-xs outline-none focus:border-danger"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              const formData = new FormData();
              formData.set("userId", userId);
              formData.set("reason", reason);
              startTransition(async () => {
                const result = await banUserAction(formData);
                if (result.ok) setConfirming(false);
                else setError(result.error);
              });
            }}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-danger min-h-9 px-3 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? <VyraMarkSpinner className="text-sm" /> : <Ban className="size-3.5" />}
            Ja, blokkeren
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
      className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger"
    >
      <Ban className="size-3.5" /> Blokkeren
    </button>
  );
}
