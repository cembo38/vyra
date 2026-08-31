"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowUp, File as FileIcon, Paperclip, Sparkles, X } from "lucide-react";
import { sendMessageAction, sendSupplierMessageAction } from "@/lib/actions/message-actions";
import { draftSupplierReplyAction } from "@/lib/actions/supplier-assistant-actions";
import { TemplatePicker } from "@/components/app/TemplatePicker";
import { VoiceInputButton } from "@/components/app/VoiceInputButton";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { SupplierCategory } from "@/lib/types";

// Zelfde grenzen als lib/data/store.ts (MESSAGE_ATTACHMENT_MAX_BYTES) en
// lib/actions/message-actions.ts (MAX_ATTACHMENTS_PER_MESSAGE) — hier
// gedupliceerd voor directe feedback vóórdat er iets naar de server gaat;
// de server valideert dit sowieso nog een keer, dit is puur UX.
const MAX_FILES = 5;
const MAX_BYTES = 8 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftPending, startDraftTransition] = useTransition();
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setError(null);
    const accepted: File[] = [];
    for (const f of Array.from(picked)) {
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") {
        setError("Alleen foto's of pdf's kunnen als bijlage.");
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is groter dan 8MB.`);
        continue;
      }
      accepted.push(f);
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim() && files.length === 0) return;
        const value = text;
        const valueFiles = files;
        setText("");
        setFiles([]);
        setError(null);
        setDraftNote(null);
        startTransition(async () => {
          const result = await (sender === "supplier" ? sendSupplierMessageAction : sendMessageAction)(eventId, categoryKey, supplierId, value, valueFiles);
          // We wissen het invoerveld optimistisch (hierboven), maar bij een
          // mislukte verzending was het getypte bericht daarmee kwijt — de
          // gebruiker moest het uit het hoofd overtypen. Zet het terug zodat
          // ze het gewoon opnieuw kunnen versturen.
          if (!result.ok) {
            setError(result.error ?? "Versturen is niet gelukt.");
            setText(value);
            setFiles(valueFiles);
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
          {draftPending ? <VyraMarkSpinner className="text-sm" /> : <Sparkles className="motion-icon-twinkle size-3.5" />}
          VyrAI-concept
        </button>
      )}
      {draftNote && <p className="mb-2 rounded-lg bg-ochre-50 px-3 py-1.5 text-xs text-ink-soft">{draftNote}</p>}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span key={`${f.name}-${i}`} className="flex items-center gap-1.5 rounded-full border border-line bg-paper-dim py-1 pr-1.5 pl-2.5 text-xs text-ink-soft">
              <FileIcon className="size-3.5 shrink-0" />
              <span className="max-w-[9rem] truncate">{f.name}</span>
              <span className="text-ink-faint">{formatFileSize(f.size)}</span>
              <button type="button" onClick={() => removeFile(i)} aria-label={`${f.name} verwijderen`} className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-line-soft">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-full border border-line bg-white p-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= MAX_FILES}
          aria-label="Bijlage toevoegen"
          className="icon-pop flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim disabled:opacity-30 disabled:pointer-events-none"
        >
          <Paperclip className="size-4" />
        </button>
        {sender === "supplier" && <TemplatePicker kind="message" currentText={text} onInsert={setText} openUpward />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Typ of spreek een bericht in…"
          className="flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-ink-faint"
        />
        <VoiceInputButton className="size-10" onTranscript={(t) => setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
        <button type="submit" disabled={pending || (!text.trim() && files.length === 0)} aria-label="Versturen" className="icon-pop flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30 disabled:pointer-events-none">
          {pending ? <VyraMarkSpinner className="text-base" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      {error && <p className="mt-1.5 px-2 text-xs text-danger">{error}</p>}
    </form>
  );
}
