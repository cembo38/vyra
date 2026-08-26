"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, MessageSquare, Star, UserX, X } from "lucide-react";
import { submitReviewAction } from "@/lib/actions/review-actions";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { formatDateNL, getVideoEmbedUrl } from "@/lib/utils";
import { Review } from "@/lib/types";
import { cn } from "@/lib/utils";

// Zelfde grenzen als lib/actions/review-actions.ts (MAX_REVIEW_PHOTOS/
// MAX_REVIEW_PHOTO_BYTES) — hier gedupliceerd voor directe feedback vóórdat
// er iets naar de server gaat, net als bij MessageComposer.tsx.
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= value ? "fill-ochre text-ochre" : "text-line")} />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} van 5 sterren`} className="chip-hover p-0.5">
          <Star className={cn("size-6", n <= value ? "fill-ochre text-ochre" : "text-line")} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review, label }: { review: Review; label: string }) {
  const videoEmbedUrl = review.videoUrl ? getVideoEmbedUrl(review.videoUrl) : null;
  return (
    <div className="rounded-xl border border-line-soft bg-paper-dim px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        <Stars value={review.rating} />
      </div>
      {review.comment && <p className="mt-1.5 text-sm text-ink-soft">{review.comment}</p>}
      {review.photoUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.photoUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="img-zoom-wrap block size-16 overflow-hidden rounded-lg border border-line-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Foto bij beoordeling" className="img-zoom h-full w-full object-cover" />
            </a>
          ))}
        </div>
      )}
      {videoEmbedUrl && (
        <div className="mt-2 aspect-video max-w-xs overflow-hidden rounded-lg border border-line-soft">
          <iframe
            src={videoEmbedUrl}
            title="Video bij beoordeling"
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {review.noShow && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <UserX className="size-3.5" /> Niet komen opdagen gemeld
        </p>
      )}
      <p className="mt-1.5 text-xs text-ink-faint">{formatDateNL(review.createdAt)}</p>
    </div>
  );
}

/**
 * Wederzijdse beoordeling na een geaccepteerde boeking (spec-item,
 * Airbnb-geïnspireerd) — vier mogelijke weergaven:
 *  1. Nog geen eigen review: een "Beoordeel"-trigger die een klein formulier
 *     uitklapt (sterren + optioneel commentaar + voor leveranciers een
 *     "niet komen opdagen"-vinkje).
 *  2. Eigen review verstuurd, tegenpartij nog niet onthuld: bevestiging +
 *     uitleg waarom de tegenpartij-review nog niet zichtbaar is.
 *  3. Beide onthuld: allebei de reviews naast elkaar.
 * Zelfde self-service-patroon (client component, `{ ok, error }`-actie,
 * `router.refresh()` bij succes) als SpotlightPanel.tsx.
 */
export function ReviewComposer({
  offerId,
  reviewerRole,
  ownReview,
  counterpartReview,
  counterpartLabel,
  revealed,
}: {
  offerId: string;
  reviewerRole: "organizer" | "supplier";
  ownReview: Review | null;
  counterpartReview: Review | null;
  counterpartLabel: string;
  revealed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [noShow, setNoShow] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addPhotos(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setError(null);
    const accepted: File[] = [];
    for (const f of Array.from(picked)) {
      if (!f.type.startsWith("image/")) {
        setError("Alleen foto's kunnen worden toegevoegd.");
        continue;
      }
      if (f.size > MAX_PHOTO_BYTES) {
        setError(`"${f.name}" is groter dan 5MB.`);
        continue;
      }
      accepted.push(f);
    }
    setPhotos((prev) => [...prev, ...accepted].slice(0, MAX_PHOTOS));
  }

  // De tegenpartij-review kan al onthuld zijn terwijl deze gebruiker zelf
  // nog niets heeft ingevuld (bv. de 14-dagentermijn is verstreken, of de
  // ander was gewoon eerder) — dan tonen we 'm alvast, mét nog de
  // gelegenheid om zelf ook te reageren (de composer hieronder blijft
  // beschikbaar zolang ownReview ontbreekt).
  const revealedCounterpartCard =
    revealed && counterpartReview ? <ReviewCard review={counterpartReview} label={`Beoordeling van ${counterpartLabel}`} /> : null;

  if (ownReview && revealedCounterpartCard) {
    return (
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <ReviewCard review={ownReview} label="Jouw beoordeling" />
        {revealedCounterpartCard}
      </div>
    );
  }

  if (ownReview && revealed) {
    // Onthuld (bv. de 14-dagentermijn is verstreken), maar de tegenpartij
    // heeft zelf nooit een beoordeling achtergelaten.
    return (
      <div className="mt-3 space-y-2">
        <ReviewCard review={ownReview} label="Jouw beoordeling" />
        <p className="text-xs text-ink-faint">{counterpartLabel} heeft geen beoordeling achtergelaten.</p>
      </div>
    );
  }

  if (ownReview) {
    return (
      <div className="mt-3 space-y-2">
        <ReviewCard review={ownReview} label="Jouw beoordeling" />
        <p className="text-xs text-ink-faint">
          Wordt zichtbaar zodra {counterpartLabel} ook een beoordeling heeft achtergelaten (of automatisch na uiterlijk 14 dagen).
        </p>
      </div>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitReviewAction({ offerId, rating, comment, noShow, photos, videoUrl });
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <div className="mt-3 space-y-2">
        {revealedCounterpartCard}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="chip-hover flex items-center gap-1.5 text-sm font-medium text-clay hover:underline"
        >
          <MessageSquare className="size-3.5" /> Beoordeel {counterpartLabel}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {revealedCounterpartCard}
      <div className="space-y-3 rounded-xl border border-line p-3.5">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">Jouw beoordeling van {counterpartLabel}</p>
          <StarPicker value={rating} onChange={setRating} />
        </div>
        <Textarea rows={2} placeholder="Optioneel — vertel iets over je ervaring" value={comment} onChange={(e) => setComment(e.target.value)} />
        {reviewerRole === "organizer" && (
          <div className="space-y-2.5 border-t border-line-soft pt-3">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
                className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
              >
                <Camera className="size-3.5" /> Foto&apos;s toevoegen ({photos.length}/{MAX_PHOTOS})
              </button>
              {photos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {photos.map((f, i) => (
                    <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-full border border-line bg-white py-1 pr-1 pl-2.5 text-xs text-ink-soft">
                      {f.name}
                      <button type="button" onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} aria-label={`${f.name} verwijderen`} className="flex size-5 items-center justify-center rounded-full hover:bg-line-soft">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Field label="Videolink" hint="Optioneel — YouTube of Vimeo">
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
            </Field>
          </div>
        )}
        {reviewerRole === "supplier" && (
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={noShow} onChange={(e) => setNoShow(e.target.checked)} className="size-4 rounded border-line text-clay accent-clay" />
            Deze organisator kwam niet opdagen
          </label>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="lift-hover flex items-center gap-1.5 rounded-xl bg-clay px-4 py-2 text-sm font-medium text-white hover:bg-clay-dark disabled:opacity-60"
          >
            {pending && <Loader2 className="size-3.5 animate-spin" />} Beoordeling versturen
          </button>
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:text-ink">
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}
