"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ImagePlus, MessageSquarePlus, Send, X } from "lucide-react";
import { submitGalleryMessageAction, uploadGalleryPhotoAction } from "@/lib/actions/gallery-actions";
import { Textarea } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Twee grote "+"-knoppen (foto / berichtje) i.p.v. twee altijd-zichtbare
 * formulierkaarten — Cem vond het te veel moeite om eerst een naam en dan
 * pas een foto te moeten invullen. Nu: tik op de camera-knop en de
 * fotokiezer van het toestel gaat DIRECT open (geen tussenscherm); tik op
 * de berichtje-knop voor een klein opklap-formuliertje. De naam is één
 * gedeeld, optioneel veldje voor beide (niet per actie apart), en blijft
 * onthouden voor volgende uploads/berichten binnen hetzelfde bezoek.
 */
export function GalleryQuickActions({
  uploadToken,
  allowVideo,
  allowGuestbook,
  maxUploadMb,
}: {
  uploadToken: string;
  allowVideo: boolean;
  allowGuestbook: boolean;
  maxUploadMb: number;
}) {
  const [guestName, setGuestName] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);

  const [photoPending, startPhotoTransition] = useTransition();
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSuccessCount, setPhotoSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messagePending, startMessageTransition] = useTransition();
  const [messageText, setMessageText] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSent, setMessageSent] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);

    if (file.size > maxUploadMb * 1024 * 1024) {
      setPhotoError(`Dit bestand is groter dan de toegestane ${maxUploadMb}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("guestName", guestName);

    startPhotoTransition(async () => {
      const result = await uploadGalleryPhotoAction(uploadToken, formData);
      if (result.ok) setPhotoSuccessCount((n) => n + 1);
      else setPhotoError(result.error ?? "Uploaden is mislukt. Probeer het nog eens.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleMessageSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessageError(null);
    if (!messageText.trim()) {
      setMessageError("Schrijf eerst een bericht.");
      return;
    }
    const formData = new FormData();
    formData.set("guestName", guestName);
    formData.set("message", messageText);

    startMessageTransition(async () => {
      const result = await submitGalleryMessageAction(uploadToken, formData);
      if (result.ok) {
        setMessageSent(true);
        setMessageText("");
      } else {
        setMessageError(result.error ?? "Versturen is mislukt. Probeer het nog eens.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center [box-shadow:var(--shadow-card)]">
      <input
        ref={fileInputRef}
        type="file"
        accept={allowVideo ? "image/*,video/*" : "image/*"}
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex items-center justify-center gap-8 sm:gap-12">
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={photoPending} className="flex flex-col items-center gap-2">
          <span className="lift-hover flex size-16 items-center justify-center rounded-full bg-clay text-white [box-shadow:var(--shadow-pop)] disabled:opacity-60">
            {photoPending ? <VyraMarkSpinner className="text-xl" /> : <ImagePlus className="size-7" />}
          </span>
          <span className="text-sm font-medium text-ink">Foto toevoegen</span>
        </button>

        {allowGuestbook && (
          <button type="button" onClick={() => setMessageOpen(true)} className="flex flex-col items-center gap-2">
            <span className="lift-hover flex size-16 items-center justify-center rounded-full bg-sage text-white [box-shadow:var(--shadow-pop)]">
              <MessageSquarePlus className="size-7" />
            </span>
            <span className="text-sm font-medium text-ink">Berichtje achterlaten</span>
          </button>
        )}
      </div>

      <div className="mx-auto mt-5 max-w-[220px]">
        <input
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          maxLength={100}
          placeholder="Je naam (optioneel)"
          className="w-full rounded-full border border-line bg-paper-dim px-4 py-1.5 text-center text-xs text-ink placeholder:text-ink-faint outline-none focus:border-sage"
        />
      </div>

      {photoError && <p className="mt-4 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger">{photoError}</p>}
      {photoSuccessCount > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" />
          {photoSuccessCount === 1 ? "Bedankt! Je foto is verstuurd en verschijnt hier zodra deze is goedgekeurd." : `${photoSuccessCount} foto's verstuurd — je kunt er nog meer toevoegen.`}
        </p>
      )}

      {messageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" onClick={() => setMessageOpen(false)}>
          <form
            onSubmit={handleMessageSubmit}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-left [box-shadow:var(--shadow-pop)]"
          >
            <button type="button" onClick={() => setMessageOpen(false)} aria-label="Sluiten" className="absolute right-4 top-4 text-ink-faint hover:text-ink">
              <X className="size-5" />
            </button>
            <h3 className="font-display text-lg text-ink">Berichtje achterlaten</h3>
            <div className="mt-4">
              <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={4} maxLength={1000} placeholder="Laat een leuke wens of herinnering achter…" autoFocus />
            </div>

            {messageError && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger">{messageError}</p>}
            {messageSent && (
              <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm text-success">
                <Check className="size-4 shrink-0" /> Bedankt! Je bericht verschijnt hier zodra het is goedgekeurd.
              </p>
            )}

            <button
              type="submit"
              disabled={messagePending}
              className="lift-hover mt-4 inline-flex items-center gap-2 rounded-xl bg-sage px-5 py-2.5 text-sm font-medium text-white hover:bg-sage-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {messagePending ? <VyraMarkSpinner className="text-base" /> : <Send className="size-4" />}
              Versturen
            </button>
          </form>
        </div>
      )}

      <p className="mt-4 text-xs text-ink-faint">Elke upload wordt eerst kort bekeken door de organisator voordat &apos;ie voor anderen zichtbaar wordt.</p>
    </div>
  );
}
