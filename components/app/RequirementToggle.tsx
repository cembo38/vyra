"use client";

import { useOptimistic, useTransition } from "react";
import { toggleRequirementAction } from "@/lib/actions/event-actions";
import { cn } from "@/lib/utils";

export function RequirementToggle({ eventId, categoryId, selected }: { eventId: string; categoryId: string; selected: boolean }) {
  const [optimisticSelected, setOptimisticSelected] = useOptimistic(selected);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimisticSelected}
      aria-label={optimisticSelected ? "Categorie deselecteren" : "Categorie selecteren"}
      onClick={() => {
        const next = !optimisticSelected;
        startTransition(async () => {
          setOptimisticSelected(next);
          await toggleRequirementAction(eventId, categoryId, next);
        });
      }}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        optimisticSelected ? "bg-clay" : "bg-line"
      )}
    >
      <span className={cn("inline-block size-4.5 transform rounded-full bg-white shadow transition-transform", optimisticSelected ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}
