"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Flashlight, Loader2, Zap } from "lucide-react";
import { activateSpotlightAction, requestSpotlightBoostAction } from "@/lib/actions/supplier-actions";
import { SPOTLIGHT_DURATION_DAYS } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory, Spotlight, SpotlightBoostRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

function daysLeft(expiresAt: string): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * Zelfbedienings-activatie van een "spotlight" — een leverancier zet één van
 * zijn eigen categorieën 3 dagen bovenaan de openbare /leveranciers-
 * zoekresultaten (zie SPOTLIGHT_DURATION_DAYS in lib/config.ts), met een
 * oplopende maandelijkse limiet per abonnementsniveau (SPOTLIGHT_MONTHLY_QUOTA).
 *
 * "Losse Spotlight-boost" (livegang-audit) — `bonusCredits` (verdiend via
 * het referral-programma of een goedgekeurde boost-aanvraag) werkt ALTIJD,
 * ook op Starter/Groei zonder eigen quotum: de activatieknop is dus nooit
 * meer hard geblokkeerd puur op abonnementsniveau, alleen op "niets meer
 * over" (geen quotum én geen credits).
 */
export function SpotlightPanel({
  categories,
  activeSpotlights,
  quota,
  usedThisMonth,
  bonusCredits,
  pendingBoostRequest,
}: {
  categories: SupplierCategory[];
  activeSpotlights: Spotlight[];
  quota: number;
  usedThisMonth: number;
  bonusCredits: number;
  pendingBoostRequest: SpotlightBoostRequest | null;
}) {
  const [pendingCategory, setPendingCategory] = useState<SupplierCategory | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [boostPending, startBoostTransition] = useTransition();
  const [boostRequested, setBoostRequested] = useState(false);
  const router = useRouter();

  const activeByCategory = new Map(activeSpotlights.map((s) => [s.categoryKey, s]));
  const remainingQuota = Math.max(0, quota - usedThisMonth);
  const canActivate = remainingQuota > 0 || bonusCredits > 0;

  function activate(categoryKey: SupplierCategory) {
    if (pending) return;
    setError(null);
    setPendingCategory(categoryKey);
    startTransition(async () => {
      const result = await activateSpotlightAction(categoryKey);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        setPendingCategory(null);
        return;
      }
      setPendingCategory(null);
      router.refresh();
    });
  }

  function requestBoost() {
    setError(null);
    startBoostTransition(async () => {
      const result = await requestSpotlightBoostAction();
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setBoostRequested(true);
    });
  }

  return (
    <div>
      {quota > 0 ? (
        <p className="text-sm text-ink-soft">
          Nog <strong>{remainingQuota}</strong> van je {quota} gratis spotlight{quota !== 1 ? "s" : ""} deze maand beschikbaar
          {bonusCredits > 0 && <> · <strong>{bonusCredits}</strong> bonus-credit{bonusCredits !== 1 ? "s" : ""} erbij</>}. Elke spotlight zet
          één categorie {SPOTLIGHT_DURATION_DAYS} dagen bovenaan de zoekresultaten, met een &quot;Uitgelicht&quot;-badge.
        </p>
      ) : bonusCredits > 0 ? (
        <p className="text-sm text-ink-soft">
          Spotlights zijn normaal beschikbaar vanaf Pro, maar je hebt <strong>{bonusCredits}</strong> bonus-credit{bonusCredits !== 1 ? "s" : ""} (via referrals of een goedgekeurde boost) — daarmee kun je hieronder toch een categorie activeren.
        </p>
      ) : (
        <p className="text-sm text-ink-soft">
          Spotlights zijn beschikbaar vanaf het Pro-abonnement —{" "}
          <Link href="/supplier/profile" className="font-medium text-clay hover:underline">kies een hoger niveau bij Abonnement</Link>, verdien
          een gratis boost via het referral-programma hieronder, of vraag een losse boost aan.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((c) => {
          const active = activeByCategory.get(c);
          const isBusy = pending && pendingCategory === c;
          return (
            <div
              key={c}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                active ? "border-ochre/40 bg-ochre-50 text-ink" : "border-line bg-white text-ink-soft"
              )}
            >
              <span>{SUPPLIER_CATEGORY_LABELS[c]}</span>
              {active ? (
                <span className="flex items-center gap-1 text-ochre">
                  <Flashlight className="size-3.5" /> nog {daysLeft(active.expiresAt)} dag{daysLeft(active.expiresAt) !== 1 ? "en" : ""}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={pending || !canActivate}
                  onClick={() => activate(c)}
                  className="chip-hover flex items-center gap-1 text-ink hover:text-clay disabled:opacity-40"
                >
                  {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Flashlight className="size-3.5" />} Activeren
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-4 border-t border-line-soft pt-3">
        {boostRequested || pendingBoostRequest ? (
          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            <Clock className="size-3.5 text-ochre" /> Je boost-aanvraag staat open en wordt binnenkort beoordeeld.
          </p>
        ) : (
          <button
            type="button"
            disabled={boostPending}
            onClick={requestBoost}
            className="chip-hover flex items-center gap-1.5 text-xs font-medium text-clay hover:underline disabled:opacity-60"
          >
            {boostPending ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />} Losse boost aanvragen
          </button>
        )}
      </div>
    </div>
  );
}
