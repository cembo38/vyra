"use client";

import { useState, useTransition } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { sendMessageAction, sendSupplierMessageAction } from "@/lib/actions/message-actions";
import { draftSupplierReplyAction } from "@/lib/actions/supplier-assistant-actions";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { SupplierCategory } from "@/lib/types";

export function MessageComposer({
  eventId,
  categoryKey,
  supplierId,
  sender = "customer",
  requestId,
  assistantEnabled = false,
}: {
  eventId: string;
  categoryKey: SupplierCategory;
  supplierId: string;
  /** "supplier" gebruikt de leverancierskant van de actie (zie lib/actions/message-actions.ts). */
  sender?: "customer" | "supplier";
  /** Nodig voor de "VyrAI-concept"-knop (Pro+) — welke aanvraag dit gesprek betreft. Alleen relevant bij sender="supplier". */
  requestId?: string;
  /** Toont de "VyrAI-concept"-knop alleen als dit true is (Pro+, zie checkSupplierAssistantAccess in lib/data/store.ts). De server action controleert dit ZELF ook nog eens — dit is puur om de knop niet zinloos te tonen aan wie er toch geen toegang toe heeft. */
  assistantEnabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftPending, startDraftTransition] = useTransition();
  const [draftNote, setDraftNote] = useState<string | null>(null);

  const showAssistantButton = sender === "supplier" && assistantEnabled && requestId;

  function requestDraft() {
    if (!requestId || draftPending) return;
    setDraftNote(null);
    startDraftTransition(async () => {
      const result = await draftSupplierReplyAction(requestId);
      if (result.blocked) {
        setDraftNote(result.draft);
        return;
      }
      setText(result.draft);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const value = text;
        setText("");
        setError(null);
        setDraftNote(null);
        startTransition(async () => {
          const result = await (sender === "supplier" ? sendSupplierMessageAction : sendMessageAction)(eventId, categoryKey, supplierId, value);
          // We wissen het invoerveld optimistisch (hierboven), maar bij een
          // mislukte verzending was het getypte bericht daarmee kwijt — de
          // gebruiker moest het uit het hoofd overtypen. Zet het terug zodat
          // ze het gewoon opnieuw kunnen versturen.
          if (!result.ok) {
            setError(result.error ?? "Versturen is niet gelukt.");
            setText(value);
          }
        });
      }}
    >
      {showAssistantButton && (
        <button
          type="button"
          onClick={requestDraft}
          disabled={draftPending}
          className="chip-hover mb-2 flex items-center gap-1.5 rounded-full border border-line bg-sage-50 px-3 py-1.5 text-xs font-medium text-sage-dark disabled:opacity-60"
        >
          {draftPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="motion-icon-twinkle size-3.5" />}
          VyrAI-concept
        </button>
      )}
      {draftNote && <p className="mb-2 rounded-lg bg-ochre-50 px-3 py-1.5 text-xs text-ink-soft">{draftNote}</p>}
      <div className="flex items-center gap-2 rounded-full border border-line bg-white p-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Typ of spreek een bericht in…"
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
        />
        <VoiceInputButton className="size-10" onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
        <button type="submit" disabled={pending || !text.trim()} aria-label="Versturen" className="icon-pop flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      {error && <p className="mt-1.5 px-2 text-xs text-danger">{error}</p>}
    </form>
  );
}
