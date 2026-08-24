"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Star, UserX } from "lucide-react";
import { submitReviewAction } from "@/lib/actions/review-actions";
import { Textarea } from "@/components/ui/Form";
import { formatDateNL } from "@/lib/utils";
import { Review } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  return (
    <div className="rounded-xl border border-line-soft bg-paper-dim px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
        <Stars value={review.rating} />
      </div>
      {review.comment && <p className="mt-1.5 text-sm text-ink-soft">{review.comment}</p>}
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
      const result = await submitReviewAction({ offerId, rating, comment, noShow });
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
