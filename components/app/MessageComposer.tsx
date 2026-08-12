"use client";

import { useState, useTransition } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { sendMessageAction } from "@/lib/actions/message-actions";
import { SupplierCategory } from "@/lib/types";

export function MessageComposer({ eventId, categoryKey, supplierId }: { eventId: string; categoryKey: SupplierCategory; supplierId: string }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const value = text;
        setText("");
        startTransition(() => sendMessageAction(eventId, categoryKey, supplierId, value));
      }}
      className="flex items-center gap-2 rounded-full border border-line bg-white p-1.5"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Typ een bericht…"
        className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-ink-faint"
      />
      <button type="submit" disabled={pending || !text.trim()} aria-label="Versturen" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
      </button>
    </form>
  );
}
