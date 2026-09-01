"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Getoond direct na terugkomst van Stripe (`?purchaseSuccess=1`) zolang de
 * gastenfoto-pagina in de database nog op `pending_payment` staat — d.w.z.
 * de webhook (checkout.session.completed -> activateEventGalleryFromWebhook
 * in lib/data/store.ts) heeft de betaling nog niet verwerkt. Dat duurt
 * normaal maar een paar seconden, maar zonder ENIGE melding hier leek de
 * pagina na het betalen "niets te doen" (Cem, sep. 2026) — precies hetzelfde
 * soort "traag ≠ kapot"-probleem als eerder bij de inlogknop
 * (VyraMarkSpinner/SubmitButton). Ververst zichzelf een tijdje automatisch;
 * blijft het te lang op `pending_payment` staan (bv. de webhook is helemaal
 * niet aangekomen bij Stripe — zie de configuratie-toelichting die Cem
 * hierover heeft gekregen), dan verschijnt een duidelijke "dit duurt langer
 * dan verwacht"-melding i.p.v. eindeloos te blijven laden.
 */
export function GalleryPaymentPendingNotice() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const MAX_ATTEMPTS = 8; // ~24 seconden bij een interval van 3s

  useEffect(() => {
    if (attempt >= MAX_ATTEMPTS) return;
    const timer = setTimeout(() => {
      setAttempt((n) => n + 1);
      router.refresh();
    }, 3000);
    return () => clearTimeout(timer);
  }, [attempt, router]);

  const tookTooLong = attempt >= MAX_ATTEMPTS;

  return (
    <div className={tookTooLong ? "rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning" : "flex items-center gap-2.5 rounded-xl bg-sage-50 px-4 py-3 text-sm text-sage-dark"}>
      {tookTooLong ? (
        <p>
          Je betaling duurt langer dan verwacht om te verwerken. Vernieuw deze pagina over een minuutje handmatig, of neem contact op als de
          gastenfoto-pagina dan nog steeds niet actief is.
        </p>
      ) : (
        <>
          <VyraMarkSpinner className="shrink-0 text-base" />
          <p>We verwerken je betaling — dit duurt meestal maar een paar seconden.</p>
        </>
      )}
    </div>
  );
}
