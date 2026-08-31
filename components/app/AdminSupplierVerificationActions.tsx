"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, X } from "lucide-react";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { approveSupplierVerificationAction, rejectSupplierVerificationAction, type ActionResult } from "@/lib/actions/admin-actions";

/** Zelfde inline-actie-patroon als `AdminUserActions` — geen navigatie weg van het dashboard nodig. */
export function AdminSupplierVerificationActions({ supplierId }: { supplierId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<ActionResult>) {
    setError(null);
    const formData = new FormData();
    formData.set("supplierId", supplierId);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(approveSupplierVerificationAction)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-success min-h-9 px-3 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <BadgeCheck className="size-3.5" />}
          Goedkeuren
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(rejectSupplierVerificationAction)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <X className="size-3.5" />}
          Afwijzen
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
