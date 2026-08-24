"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flashlight, Loader2 } from "lucide-react";
import { activateSpotlightAction } from "@/lib/actions/supplier-actions";
import { SPOTLIGHT_DURATION_DAYS } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory, Spotlight } from "@/lib/types";
import { cn } from "@/lib/utils";

function daysLeft(expiresAt: string): number {
  return Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * Zelfbedienings-activatie van een "spotlight" — een leverancier zet één van
 * zijn eigen categorieën 3 dagen bovenaan de openbare /leveranciers-
 * zoekresultaten (zie SPOTLIGHT_DURATION_DAYS in lib/config.ts), met een
 * oplopende maandelijkse limiet per abonnementsniveau (SPOTLIGHT_MONTHLY_QUOTA).
 * Zelfde vorm als SubscriptionTierPicker.tsx: client component, roept een
 * `{ ok, error }`-server action aan, ververst de pagina bij succes.
 */
export function SpotlightPanel({
  categories,
  activeSpotlights,
  quota,
  usedThisMonth,
}: {
  categories: SupplierCategory[];
  activeSpotlights: Spotlight[];
  quota: number;
  usedThisMonth: number;
}) {
  const [pendingCategory, setPendingCategory] = useState<SupplierCategory | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const activeByCategory = new Map(activeSpotlights.map((s) => [s.categoryKey, s]));
  const remaining = Math.max(0, quota - usedThisMonth);

  if (quota <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-faint">
        Spotlights zijn beschikbaar vanaf het Pro-abonnement — kies hierboven een hoger niveau om gratis extra zichtbaarheid voor een van je categorieën te activeren.
      </div>
    );
  }

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

  return (
    <div>
      <p className="text-sm text-ink-soft">
        Nog <strong>{remaining}</strong> van je {quota} spotlight{quota !== 1 ? "s" : ""} deze maand beschikbaar. Elke spotlight zet één
        categorie {SPOTLIGHT_DURATION_DAYS} dagen bovenaan de zoekresultaten, met een &quot;Uitgelicht&quot;-badge.
      </p>
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
                  disabled={pending || remaining <= 0}
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
    </div>
  );
}
