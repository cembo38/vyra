"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { updateRequirementDraftAction } from "@/lib/actions/event-actions";

/**
 * Het conceptbericht dat straks (ongewijzigd of aangepast) naar
 * leveranciers gestuurd wordt voor deze categorie — zie
 * draftSupplierMessages() in lib/ai/planning.ts. Slaat op bij het
 * verlaten van het veld (onBlur), niet bij elke toetsaanslag, om niet
 * onnodig vaak te schrijven.
 */
export function RequirementDraftEditor({ eventId, categoryId, initialMessage }: { eventId: string; categoryId: string; initialMessage: string | null }) {
  const [text, setText] = useState(initialMessage ?? "");
  const [savedText, setSavedText] = useState(initialMessage ?? "");
  const [pending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  function save() {
    if (text === savedText) return;
    startTransition(async () => {
      await updateRequirementDraftAction(eventId, categoryId, text);
      setSavedText(text);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    });
  }

  return (
    <div className="mt-3 rounded-xl border border-line-soft bg-paper-dim/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-faint">
        <Sparkles className="size-3.5 text-sage" />
        Conceptbericht voor leveranciers
        {pending && <Loader2 className="size-3 animate-spin text-ink-faint" />}
        {!pending && justSaved && (
          <span className="flex items-center gap-0.5 text-sage-dark">
            <Check className="size-3" /> opgeslagen
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        rows={3}
        placeholder="Er is nog geen conceptbericht — typ hier wat je aan leveranciers wilt laten weten."
        className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-sage"
      />
      <p className="mt-1.5 text-[11px] text-ink-faint">Dit gaat, zoals het nu is geschreven, mee zodra je een aanvraag voor deze categorie verstuurt — pas het gerust aan.</p>
    </div>
  );
}
