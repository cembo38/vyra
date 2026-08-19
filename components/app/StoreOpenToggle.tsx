"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toggleStoreOpenAction } from "@/lib/actions/supplier-actions";
import { cn } from "@/lib/utils";

/**
 * "Winkel open/gesloten" (spec-item #55) — een schuifje waarmee een
 * leverancier zichzelf tijdelijk onvindbaar zet (vakantie, te druk, etc.)
 * zonder eerst elke datum apart te hoeven blokkeren. Gesloten = uitgesloten
 * van zowel de zoekresultaten (`searchSupplierAccounts`) als de
 * AI-matching (`findRealMatchingSuppliers`) — zie lib/data/store.ts.
 */
export function StoreOpenToggle({ open }: { open: boolean }) {
  const [isOpen, setIsOpen] = useState(open);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !isOpen;
    setIsOpen(next); // optimistisch — de server-actie faalt in de praktijk vrijwel nooit voor een ingelogde leverancier
    startTransition(async () => {
      const result = await toggleStoreOpenAction(next);
      if (!result.ok) {
        setIsOpen(!next); // terugdraaien bij een fout
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      role="switch"
      aria-checked={isOpen}
      aria-label={isOpen ? "Winkel is open — klik om te sluiten" : "Winkel is gesloten — klik om te openen"}
      className={cn(
        "chip-hover inline-flex items-center gap-2.5 rounded-full border px-3 py-2 text-sm font-medium transition disabled:opacity-60",
        isOpen ? "border-success-50 bg-success-50 text-success" : "border-line bg-paper-dim text-ink-soft"
      )}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          isOpen ? "bg-success" : "bg-ink-faint/40"
        )}
      >
        <span className={cn("inline-block size-3.5 rounded-full bg-white shadow transition-transform", isOpen ? "translate-x-4.5" : "translate-x-1")} />
      </span>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {isOpen ? "Winkel open" : "Winkel gesloten"}
    </button>
  );
}
