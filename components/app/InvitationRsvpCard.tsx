"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { InvitationCard, InvitationCardProps } from "@/components/app/InvitationCard";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";
import { submitGalleryRsvpAction } from "@/lib/actions/gallery-actions";
import { GalleryRsvpStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: GalleryRsvpStatus; label: string }[] = [
  { value: "yes", label: "Ik kom" },
  { value: "maybe", label: "Misschien" },
  { value: "no", label: "Kan niet" },
];

/**
 * Wikkelt de niet-bewerkbare InvitationCard in op de publieke deelpagina
 * (/uitnodiging/[token]) en maakt de RSVP-knop in de kaart daadwerkelijk
 * klikbaar — opent een klein formulier (naam, ja/misschien/nee, aantal
 * personen, optionele opmerking) dat privé bij de organisator terechtkomt
 * op het "Gastenfoto's"-tabblad (nieuwe sectie "Aanmeldingen"). Zelfde
 * modal-opzet als GalleryQuickActions.tsx (het berichtje-formulier daar).
 */
export function InvitationRsvpCard({ uploadToken, ...cardProps }: Omit<InvitationCardProps, "onRsvpClick" | "editable"> & { uploadToken: string }) {
  const [open, setOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [status, setStatus] = useState<GalleryRsvpStatus>("yes");
  const [guestCount, setGuestCount] = useState(1);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!guestName.trim()) {
      setError("Vul je naam in.");
      return;
    }
    const formData = new FormData();
    formData.set("guestName", guestName);
    formData.set("status", status);
    formData.set("guestCount", String(guestCount));
    formData.set("note", note);
    startTransition(async () => {
      const result = await submitGalleryRsvpAction(uploadToken, formData);
      if (result.ok) setSent(true);
      else setError(result.error ?? "Versturen is mislukt. Probeer het nog eens.");
    });
  }

  return (
    <>
      <InvitationCard {...cardProps} editable={false} onRsvpClick={() => setOpen(true)} />

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-left [box-shadow:var(--shadow-pop)]">
            <button type="button" onClick={() => setOpen(false)} aria-label="Sluiten" className="absolute right-4 top-4 text-ink-faint hover:text-ink">
              <X className="size-5" />
            </button>

            {sent ? (
              <div className="py-4 text-center">
                <Check className="mx-auto size-8 text-success" />
                <h3 className="mt-3 font-display text-lg text-ink">Bedankt!</h3>
                <p className="mt-1 text-sm text-ink-soft">Je aanmelding is doorgegeven aan de organisator.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className="font-display text-lg text-ink">Bevestig je komst</h3>
                <div className="mt-4 space-y-3">
                  <Field label="Je naam" required>
                    <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} maxLength={100} placeholder="Voor- en achternaam" autoFocus />
                  </Field>

                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className={`rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors ${
                          status === opt.value ? "border-clay bg-clay-50 text-clay-dark" : "border-line text-ink-soft hover:border-clay/40"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {status !== "no" && (
                    <Field label="Aantal personen" hint="Inclusief jezelf">
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={guestCount}
                        onChange={(e) => setGuestCount(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                      />
                    </Field>
                  )}

                  <Field label="Opmerking" hint="Bijvoorbeeld dieetwensen (optioneel)">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
                  </Field>
                </div>

                {error && <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-sm text-danger">{error}</p>}

                <button
                  type="submit"
                  disabled={pending}
                  className="lift-hover mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-5 py-2.5 text-sm font-medium text-white hover:bg-clay-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? <VyraMarkSpinner className="text-base" /> : <Check className="size-4" />}
                  Versturen
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
