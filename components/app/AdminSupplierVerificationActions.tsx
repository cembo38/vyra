"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, Loader2, X } from "lucide-react";
import { approveSupplierVerificationAction, rejectSupplierVerificationAction } from "@/lib/actions/admin-actions";

/** Zelfde inline-actie-patroon als `AdminUserActions` — geen navigatie weg van het dashboard nodig. */
export function AdminSupplierVerificationActions({ supplierId }: { supplierId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<void>) {
    setError(null);
    const formData = new FormData();
    formData.set("supplierId", supplierId);
    startTransition(async () => {
      try {
        await action(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Dit is niet gelukt.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(approveSupplierVerificationAction)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />}
          Goedkeuren
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(rejectSupplierVerificationAction)}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
          Afwijzen
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
