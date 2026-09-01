"use client";

import { useState, useTransition } from "react";
import { startGalleryCheckoutAction } from "@/lib/actions/gallery-actions";
import { GalleryTier } from "@/lib/config";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * `startGalleryCheckoutAction` geeft (op de foutpaden) een `{ok, error}`
 * terug — een server action die iets teruggeeft kan niet rechtstreeks als
 * `<form action={...}>` gebonden worden (React staat daar alleen
 * void/Promise<void> toe), dus zelfde client-side useTransition-aanroep als
 * changeSubscriptionTierAction in SubscriptionTierPicker.tsx. Bij succes
 * gooit de action zelf een `redirect()` naar Stripe — dat werkt ook
 * programmatisch aangeroepen, zoals dat bestaande patroon al bewijst.
 */
export function GalleryPurchaseButton({ eventId, tier, label, disabled }: { eventId: string; tier: GalleryTier; label: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startGalleryCheckoutAction(eventId, tier);
            if (!result.ok) setError(result.error ?? "Er ging iets mis. Probeer het nog eens.");
          })
        }
        className="lift-hover flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-5 py-3 text-center text-sm font-medium text-white hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && <VyraMarkSpinner className="text-base" />}
        {label}
      </button>
      {error && <p className="mt-2 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
