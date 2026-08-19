"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { toggleSupplierFavoriteAction } from "@/lib/actions/misc-actions";
import { cn } from "@/lib/utils";

/**
 * Sla een leverancier op als favoriet — het directe, positieve tegenwicht
 * tegen het "nummer vragen en weglopen"-risico (spec-item #54): een
 * organisator die tevreden was heeft nu een reden om via Vyra terug te
 * komen (de "Mijn leveranciers"-lijst) i.p.v. de leverancier voortaan
 * alleen nog rechtstreeks te benaderen.
 */
export function FavoriteSupplierButton({ supplierId, initialFavorited }: { supplierId: string; initialFavorited: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle() {
    const next = !favorited;
    setFavorited(next); // optimistisch — voelt direct aan, en de server-actie faalt in de praktijk vrijwel nooit voor een ingelogde gebruiker
    startTransition(async () => {
      const result = await toggleSupplierFavoriteAction(supplierId, next);
      if (!result.ok) {
        setFavorited(!next); // terugdraaien bij een fout (bv. sessie verlopen)
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
      aria-pressed={favorited}
      aria-label={favorited ? "Verwijderen uit favorieten" : "Opslaan als favoriet"}
      className={cn(
        "chip-hover inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-60",
        favorited ? "border-clay/40 bg-clay/10 text-clay" : "border-line bg-white text-ink-faint hover:border-clay/40 hover:text-clay"
      )}
    >
      {pending ? <Loader2 className="size-4.5 animate-spin" /> : <Heart className={cn("size-4.5", favorited && "fill-clay")} />}
    </button>
  );
}
