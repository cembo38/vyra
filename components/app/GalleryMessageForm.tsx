"use client";

import { useState, useTransition } from "react";
import { Check, Send } from "lucide-react";
import { submitGalleryMessageAction } from "@/lib/actions/gallery-actions";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/** Gastenboek-bericht achterlaten — zelfde "client-side, blijft op dezelfde plek" opzet als GalleryUploadForm, om dezelfde reden (een bericht is pas zichtbaar na goedkeuring). */
export function GalleryMessageForm({ uploadToken }: { uploadToken: string }) {
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!message.trim()) {
      setError("Schrijf eerst een bericht.");
      return;
    }
    const formData = new FormData();
    formData.set("guestName", guestName);
    formData.set("message", message);

    startTransition(async () => {
      const result = await submitGalleryMessageAction(uploadToken, formData);
      if (result.ok) {
        setSent(true);
        setMessage("");
      } else {
        setError(result.error ?? "Versturen is mislukt. Probeer het nog eens.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-white p-6 [box-shadow:var(--shadow-card)]">
      <Field label="Je naam" hint="Optioneel">
        <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={100} placeholder="Bijv. Marloes" />
      </Field>
      <div className="mt-4">
        <Field label="Je bericht">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder="Laat een leuke wens of herinnering achter…" />
        </Field>
      </div>

      {error && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}
      {sent && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" /> Bedankt! Je bericht verschijnt hier zodra het is goedgekeurd.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="lift-hover mt-4 inline-flex items-center gap-2 rounded-xl bg-clay px-5 py-2.5 text-sm font-medium text-white hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <VyraMarkSpinner className="text-base" /> : <Send className="size-4" />}
        Versturen
      </button>
    </form>
  );
}
