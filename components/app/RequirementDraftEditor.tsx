"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import { updateRequirementDraftAction } from "@/lib/actions/event-actions";
import { sendRequestAction } from "@/lib/actions/marketplace-actions";
import { SupplierCategory } from "@/lib/types";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Het conceptbericht dat straks (ongewijzigd of aangepast) naar
 * leveranciers gestuurd wordt voor deze categorie — zie
 * draftSupplierMessages() in lib/ai/planning.ts. Slaat op bij het
 * verlaten van het veld (onBlur), niet bij elke toetsaanslag, om niet
 * onnodig vaak te schrijven.
 *
 * Bevat ook meteen de "Stuur aanvraag"-knop (i.p.v. alleen onderaan de
 * hele planpagina één verzamelknop) — Cem's feedback was dat je voor het
 * versturen van één categorie helemaal naar beneden moest scrollen en dan
 * nog naar een aparte pagina moest, terwijl je net op dit kaartje aan het
 * kijken/bewerken was.
 */
export function RequirementDraftEditor({
  eventId,
  categoryId,
  categoryKey,
  label,
  initialMessage,
  defaultBudgetCents,
  matchCount,
  alreadySent,
}: {
  eventId: string;
  categoryId: string;
  categoryKey: SupplierCategory;
  label: string;
  initialMessage: string | null;
  defaultBudgetCents: number | null;
  /** Aantal gematchte leveranciers voor deze categorie in jouw regio — bepaalt of versturen hier al zinvol is. */
  matchCount: number;
  /** Staat deze categorie al verder dan "geselecteerd, nog niet aangevraagd" (bv. via de aparte aanvragenpagina)? Dan verbergen we de verstuurknop hier om een dubbele aanvraag te voorkomen. */
  alreadySent: boolean;
}) {
  const [text, setText] = useState(initialMessage ?? "");
  const [savedText, setSavedText] = useState(initialMessage ?? "");
  const [saving, startSaveTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [sending, startSendTransition] = useTransition();
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  function save() {
    if (text === savedText) return;
    startSaveTransition(async () => {
      await updateRequirementDraftAction(eventId, categoryId, text);
      setSavedText(text);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    });
  }

  function send() {
    setSendError(null);
    startSendTransition(async () => {
      try {
        // Sla eerst nog niet-opgeslagen wijzigingen op, zodat het bericht
        // overal consistent blijft — ook als iemand meteen op "Stuur
        // aanvraag" klikt zonder eerst uit het tekstveld te tabben.
        if (text !== savedText) {
          await updateRequirementDraftAction(eventId, categoryId, text);
          setSavedText(text);
        }
        const res = await sendRequestAction({
          eventId,
          categoryKey,
          desiredService: text.trim() || label,
          specialRequests: "",
          budgetCents: defaultBudgetCents,
        });
        setSentCount(res?.offerCount ?? 0);
      } catch {
        // Livegang-audit (aug. 2026): sendRequestAction/createAndSendRequest
        // kan een echte DB-fout `throw`en (zie lib/data/store.ts) — zonder
        // deze try/catch verdween die onbehandeld in de transition en landde
        // de gebruiker op de generieke Next.js-foutpagina i.p.v. hier, waar
        // MessageComposer.tsx ernaast al wél een nette inline melding +
        // retry-mogelijkheid toont voor precies zo'n mislukking.
        setSendError("Versturen is niet gelukt. Probeer het nog eens.");
      }
    });
  }

  if (alreadySent) {
    return (
      <div className="mt-3 rounded-xl border border-line-soft bg-paper-dim/60 px-3 py-2.5 text-xs text-ink-faint">
        Aanvraag voor deze categorie is al onderweg —{" "}
        <Link href={`/events/${eventId}/requests`} className="font-medium text-clay hover:underline">bekijk de status</Link>.
      </div>
    );
  }

  if (sentCount !== null) {
    return (
      <div className="mt-3 rounded-xl border border-success-50 bg-success-50 px-3 py-2.5 text-xs text-success">
        Aanvraag verstuurd naar {matchCount} leverancier{matchCount !== 1 ? "s" : ""}. {sentCount > 0 ? `Je hebt al ${sentCount} reactie${sentCount !== 1 ? "s" : ""}!` : "Je krijgt bericht zodra iemand reageert."}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line-soft bg-paper-dim/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-ink-faint">
        <Sparkles className="size-3.5 text-sage" />
        Conceptbericht voor leveranciers
        {saving && <Loader2 className="size-3 animate-spin text-ink-faint" />}
        {!saving && justSaved && (
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
      {matchCount === 0 ? (
        <p className="mt-1.5 text-[11px] text-ink-faint">Nog geen leveranciers voor deze categorie in jouw regio — probeer het later nog eens of pas je locatie aan.</p>
      ) : (
        <>
          <p className="mt-1.5 text-[11px] text-ink-faint">Dit gaat, zoals het nu is geschreven, mee naar {matchCount} passende leverancier{matchCount !== 1 ? "s" : ""} zodra je &apos;m verstuurt — pas het gerust aan.</p>
          <button
            type="button"
            disabled={sending}
            onClick={send}
            className="chip-hover mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-clay px-3.5 text-xs font-medium text-white hover:bg-clay-dark disabled:opacity-50 disabled:pointer-events-none"
          >
            {sending ? <VyraMarkSpinner className="text-sm" /> : <Send className="size-3.5" />}
            Stuur aanvraag naar leveranciers
          </button>
          {sendError && <p className="mt-1.5 text-[11px] text-danger">{sendError}</p>}
        </>
      )}
    </div>
  );
}
