"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Field, Textarea } from "@/components/ui/Form";
import { rewriteSupplierProfileTextAction } from "@/lib/actions/supplier-assistant-actions";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * De "Beschrijving"-Field op /supplier/profile, uitgelicht als eigen Client
 * Component zodat alleen dít veldje een "VyrAI: verbeter mijn tekst"-knop
 * (Profieltekst-hulp, Premium+) kan krijgen — de rest van het formulier
 * blijft bewust ongewijzigd (geen "use client", server-action-only), zie
 * app/supplier/(portal)/profile/page.tsx.
 *
 * Nog steeds een gewoon `<textarea name="description">` binnen dezelfde
 * buitenste `<form action={updateSupplierProfileAction}>` — een
 * gecontroleerd veld doet gewoon mee in FormData zolang het `name` heeft,
 * dus dit verandert niets aan hoe opslaan werkt.
 */
export function SupplierDescriptionField({
  defaultValue,
  companyName,
  categoryLabels,
  tagline,
  assistantEnabled,
}: {
  defaultValue: string;
  companyName: string;
  categoryLabels: string[];
  tagline: string | null;
  assistantEnabled: boolean;
}) {
  const [text, setText] = useState(defaultValue);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  function improve() {
    if (pending) return;
    setNote(null);
    startTransition(async () => {
      const res = await rewriteSupplierProfileTextAction({ companyName, categoryLabels, currentDescription: text, currentTagline: tagline });
      if (res.blocked) {
        setNote(res.description);
        return;
      }
      setText(res.description);
    });
  }

  return (
    <Field label="Beschrijving" required hint="Wat maakt jouw bedrijf bijzonder? Dit zien organisatoren bij een aanvraag.">
      {assistantEnabled && (
        <button
          type="button"
          onClick={improve}
          disabled={pending}
          className="chip-hover mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-line bg-sage-50 px-3 py-1 text-xs font-medium text-sage-dark disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <Sparkles className="motion-icon-twinkle size-3.5" />}
          VyrAI: verbeter mijn tekst
        </button>
      )}
      {note && <p className="mb-1.5 rounded-lg bg-ochre-50 px-3 py-1.5 text-xs text-ink-soft">{note}</p>}
      <Textarea name="description" required rows={3} value={text} onChange={(e) => setText(e.target.value)} />
    </Field>
  );
}
