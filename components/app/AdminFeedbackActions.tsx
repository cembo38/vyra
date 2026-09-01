"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Textarea } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { resolveFeedbackReportAction, reopenFeedbackReportAction, type ActionResult } from "@/lib/actions/admin-actions";

/** Inline afhandel-actie voor één feedback-melding — zelfde opzet als AdminDisputeActions, maar de notitie is optioneel (dit gaat naar niemand anders dan Cem zelf). */
export function AdminFeedbackActions({ reportId, isOpen }: { reportId: string; isOpen: boolean }) {
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<ActionResult>) {
    setError(null);
    const formData = new FormData();
    formData.set("reportId", reportId);
    if (note.trim()) formData.set("adminNote", note.trim());
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) setError(result.error);
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(reopenFeedbackReportAction)}
        className="chip-hover mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-white min-h-9 px-3 text-xs font-medium text-ink-soft disabled:opacity-40"
      >
        {pending ? <VyraMarkSpinner className="text-sm" /> : <RotateCcw className="size-3.5" />}
        Heropenen
      </button>
    );
  }

  return (
    <div className="mt-2.5 space-y-2">
      <Textarea rows={2} placeholder="Interne notitie (optioneel)…" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(resolveFeedbackReportAction)}
        className="chip-hover inline-flex items-center gap-1.5 rounded-full bg-success min-h-9 px-3 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
      >
        {pending ? <VyraMarkSpinner className="text-sm" /> : <Check className="size-3.5" />}
        Afgehandeld
      </button>
    </div>
  );
}
