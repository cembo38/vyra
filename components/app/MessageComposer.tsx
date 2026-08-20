"use client";

import { useState, useTransition } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { sendMessageAction, sendSupplierMessageAction } from "@/lib/actions/message-actions";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { SupplierCategory } from "@/lib/types";

export function MessageComposer({
  eventId,
  categoryKey,
  supplierId,
  sender = "customer",
}: {
  eventId: string;
  categoryKey: SupplierCategory;
  supplierId: string;
  /** "supplier" gebruikt de leverancierskant van de actie (zie lib/actions/message-actions.ts). */
  sender?: "customer" | "supplier";
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const value = text;
        setText("");
        setError(null);
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
