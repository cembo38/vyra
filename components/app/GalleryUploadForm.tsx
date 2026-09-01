"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, Upload } from "lucide-react";
import { uploadGalleryPhotoAction } from "@/lib/actions/gallery-actions";
import { Field, Input } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * Gast-uploadwidget op de publieke gastenfoto-pagina (`/gallery/[token]`).
 * Bewust GEEN `<form action={...}>` met SubmitButton (het gewone patroon
 * elders in dit project): een geüploade foto is pas zichtbaar voor andere
 * gasten NA goedkeuring door de organisator, dus een `revalidatePath` alleen
 * zou hier niets laten verschijnen — in plaats daarvan blijft de gast op
 * dezelfde plek met een bedank-melding en kan meteen nog een foto sturen,
 * net als bij ReviewComposer.tsx (client-side useTransition-aanroep i.p.v.
 * een form-submit-navigatie).
 */
export function GalleryUploadForm({ uploadToken, allowVideo, maxUploadMb }: { uploadToken: string; allowVideo: boolean; maxUploadMb: number }) {
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > maxUploadMb * 1024 * 1024) {
      setError(`Dit bestand is groter dan de toegestane ${maxUploadMb}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("guestName", guestName);

    startTransition(async () => {
      const result = await uploadGalleryPhotoAction(uploadToken, formData);
      if (result.ok) {
        setSuccessCount((n) => n + 1);
      } else {
        setError(result.error ?? "Uploaden is mislukt. Probeer het nog eens.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-6 [box-shadow:var(--shadow-card)]">
      <Field label="Je naam" hint="Optioneel — zodat de gastheer/gastvrouw weet van wie de foto is">
        <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={100} placeholder="Bijv. Marloes" />
      </Field>

      <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition-colors hover:border-clay/50 hover:bg-paper-dim">
        <input ref={fileInputRef} type="file" accept={allowVideo ? "image/*,video/*" : "image/*"} onChange={handleFileChange} disabled={pending} className="hidden" />
        {pending ? (
          <VyraMarkSpinner className="text-2xl" />
        ) : (
          <>
            <Camera className="size-6 text-ink-faint" />
            <span className="text-sm font-medium text-ink">Tik om een foto{allowVideo ? " of video" : ""} te kiezen</span>
            <span className="text-xs text-ink-faint">Tot {maxUploadMb}MB per bestand</span>
          </>
        )}
      </label>

      {error && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

      {successCount > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2 text-sm text-success">
          <Check className="size-4 shrink-0" />
          {successCount === 1 ? "Bedankt! Je foto is verstuurd en verschijnt hier zodra deze is goedgekeurd." : `${successCount} foto's verstuurd — je kunt er nog meer toevoegen.`}
        </p>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
        <Upload className="size-3.5 shrink-0" /> Elke upload wordt eerst kort bekeken door de organisator voordat &apos;ie voor anderen zichtbaar wordt.
      </p>
    </div>
  );
}
