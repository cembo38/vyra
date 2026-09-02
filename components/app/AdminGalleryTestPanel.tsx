"use client";

import { useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { GALLERY_PURCHASE_ENABLED, GALLERY_TIER_ORDER, GALLERY_TIERS, GalleryTier } from "@/lib/config";
import { adminActivateGalleryAction, adminResetGalleryAction } from "@/lib/actions/admin-actions";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Admin-only testknop (sep. 2026) — zolang GALLERY_PURCHASE_ENABLED
 * (afgeleid van of Stripe-sleutels staan, zie lib/config.ts) uit staat,
 * kan NIEMAND via de normale weg ooit bij een Premium gastenfoto-pagina
 * komen, en dus ook nooit de uitnodiging instellen: de koopknoppen tonen
 * dan alleen "Betalen is nog niet ingesteld" en er is geen enkele andere
 * ingang. Dit paneeltje activeert een pakket rechtstreeks in de database
 * (adminActivateGalleryAction, service-role, geen Stripe nodig) zodat er
 * toch getest kan worden.
 *
 * `"use client"` + useTransition (i.p.v. een simpel `<form action=...>`,
 * zoals de meeste andere knoppen op deze pagina) omdat de Server Actions
 * hier `{ ok, error }` TERUGGEVEN i.p.v. void — nodig omdat Next.js de
 * boodschap van een echt gegooide Error in productie vervangt door een
 * onleesbare generieke tekst (zie de uitleg bij `runAction()` in
 * lib/actions/admin-actions.ts). Voor een testpaneel is die foutmelding
 * juist het hele nut (bv. "SUPABASE_SERVICE_ROLE_KEY ontbreekt"), dus die
 * moet zichtbaar blijven.
 *
 * Verschijnt ALLEEN voor een ingelogde admin (zie de ADMIN_EMAILS-check in
 * app/events/[id]/gallery/page.tsx) — een gewone organisator ziet dit
 * paneel nooit.
 */
export function AdminGalleryTestPanel({
  eventId,
  currentTier,
  currentStatus,
}: {
  eventId: string;
  currentTier: GalleryTier | null;
  currentStatus: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingTier, setPendingTier] = useState<GalleryTier | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function activate(tier: GalleryTier) {
    setError(null);
    setPendingTier(tier);
    startTransition(async () => {
      const result = await adminActivateGalleryAction(eventId, tier);
      if (!result.ok) setError(result.error);
    });
  }

  function reset() {
    setError(null);
    setPendingTier("reset");
    startTransition(async () => {
      const result = await adminResetGalleryAction(eventId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="rounded-xl border border-dashed border-warning/50 bg-warning-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-1.5 font-medium text-warning">
        <ShieldAlert className="size-4 shrink-0" /> Admin-testmodus
      </div>
      <p className="mt-1 text-ink-soft">
        {GALLERY_PURCHASE_ENABLED
          ? "Snelkoppeling om een pakket te (de)activeren zonder zelf een Stripe-testbetaling te hoeven doorlopen."
          : "Betalen staat nog niet aan (geen Stripe-sleutels ingesteld) — dit is momenteel de enige manier om een pakket te activeren en zo de uitnodiging te kunnen testen."}
        {currentTier && currentStatus && (
          <>
            {" "}
            Nu: <strong>{GALLERY_TIERS[currentTier].label}</strong> ({currentStatus === "active" ? "actief" : currentStatus === "pending_payment" ? "niet gekocht" : currentStatus}).
          </>
        )}
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {GALLERY_TIER_ORDER.map((tier) => (
          <button
            key={tier}
            type="button"
            disabled={pending}
            onClick={() => activate(tier)}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-warning disabled:opacity-50"
          >
            {pending && pendingTier === tier && <VyraMarkSpinner className="text-sm" />}
            Activeer {GALLERY_TIERS[tier].label} (test)
          </button>
        ))}
        {currentStatus === "active" && (
          <button
            type="button"
            disabled={pending}
            onClick={reset}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-faint hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            {pending && pendingTier === "reset" && <VyraMarkSpinner className="text-sm" />}
            Zet terug op &quot;niet gekocht&quot;
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
