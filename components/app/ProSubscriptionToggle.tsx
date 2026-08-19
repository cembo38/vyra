"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toggleProSubscriptionAction } from "@/lib/actions/supplier-actions";
import { formatCurrency } from "@/lib/config";

/**
 * Vyra Pro aan/uit-schakelaar (spec-item #53, laag 3) — nog een
 * zelfbedienings-toggle zonder automatische incasso, net als de rest van de
 * betaalflow in deze app nog "mock" is. Zelfde interactiepatroon als
 * `SupplierBlockedDatesManager`.
 */
export function ProSubscriptionToggle({ active, priceCents }: { active: boolean; priceCents: number }) {
  const [isActive, setIsActive] = useState(active);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle() {
    const next = !isActive;
    setError(null);
    startTransition(async () => {
      const result = await toggleProSubscriptionAction(next);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setIsActive(next);
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        className={
          isActive
            ? "lift-hover inline-flex items-center gap-1.5 rounded-xl border border-ochre/40 bg-ochre-50 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ochre-50/70 disabled:opacity-60"
            : "lift-hover inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90 disabled:opacity-60"
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {isActive ? "Vyra Pro opzeggen" : `Vyra Pro activeren — ${formatCurrency(priceCents)}/maand`}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <p className="mt-2 text-xs text-ink-faint">
        Nog een zelfbedienings-schakelaar in deze pilotfase — geen automatische incasso, je kunt op elk moment weer opzeggen.
      </p>
    </div>
  );
}
