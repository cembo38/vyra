"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2, RotateCcw } from "lucide-react";
import { banUserAction, unbanUserAction } from "@/lib/actions/admin-actions";

/**
 * Blokkeren is reversibel (vandaar geen zware "typ de naam ter bevestiging"-
 * stap zoals bij het definitief verwijderen van een evenement) — een lichte
 * inline bevestiging met optionele reden volstaat, zelfde patroon als
 * `CloseEventButton`. De Server Actions gooien een Error bij een probleem
 * (bv. "kan jezelf niet blokkeren"); die vangen we hier af en tonen we
 * gewoon inline i.p.v. een onbehandelde crash.
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
              try {
                await unbanUserAction(formData);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Dit is niet gelukt.");
              }
            });
          }}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
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
                try {
                  await banUserAction(formData);
                  setConfirming(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Dit is niet gelukt.");
                }
              });
            }}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />}
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
      className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger"
    >
      <Ban className="size-3.5" /> Blokkeren
    </button>
  );
}
