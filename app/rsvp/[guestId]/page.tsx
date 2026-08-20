import { notFound } from "next/navigation";
import { getGuestPublic } from "@/lib/data/store";
import { submitPublicRsvpAction } from "@/lib/actions/guest-actions";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { Logo } from "@/components/marketing/Logo";
import { formatDateNL } from "@/lib/utils";
import { CalendarDays, MapPin } from "lucide-react";

export const metadata = { title: "RSVP — Vyra" };

const STATUS_LABEL: Record<string, string> = {
  yes: "Je hebt aangegeven dat je komt.",
  no: "Je hebt aangegeven dat je niet kunt komen.",
  maybe: "Je hebt aangegeven dat je misschien komt.",
};

export default async function RsvpPage(props: PageProps<"/rsvp/[guestId]">) {
  const { guestId } = await props.params;
  const guest = await getGuestPublic(guestId);
  if (!guest) notFound();

  const searchParams = await props.searchParams;
  const hasError = searchParams.error === "1";
  const alreadyResponded = guest.rsvpStatus !== "pending";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <p className="text-sm text-ink-faint">Je bent uitgenodigd voor</p>
          <h1 className="mt-0.5 font-display text-2xl text-ink">{guest.eventName}</h1>

          {(guest.eventDate || guest.eventLocation) && (
            <div className="mt-3 space-y-1.5">
              {guest.eventDate && (
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <CalendarDays className="size-4 text-ink-faint" /> {formatDateNL(guest.eventDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              )}
              {guest.eventLocation && (
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                  <MapPin className="size-4 text-ink-faint" /> {guest.eventLocation}
                </div>
              )}
            </div>
          )}

          <p className="mt-4 text-sm text-ink-faint">Hoi {guest.name}, laat je gastheer/gastvrouw weten of je erbij bent.</p>

          {hasError && (
            <div className="mt-4 rounded-xl bg-danger-50 px-4 py-2.5 text-sm text-danger">
              Je antwoord kon niet worden opgeslagen. Probeer het nog eens.
            </div>
          )}

          {alreadyResponded ? (
            <div className="mt-6 rounded-xl border border-line-soft bg-paper-dim px-4 py-3.5 text-sm text-ink-soft">
              {STATUS_LABEL[guest.rsvpStatus] ?? "Bedankt voor je reactie."}
              {guest.rsvpStatus === "yes" && guest.plusOnes > 0 && (
                <> Inclusief {guest.plusOnes} introducee{guest.plusOnes > 1 ? "s" : ""}.</>
              )}
              {guest.dietaryNotes && <p className="mt-1.5 text-xs text-ink-faint">Dieetwensen: {guest.dietaryNotes}</p>}
              <p className="mt-2 text-xs text-ink-faint">Wil je je antwoord aanpassen? Kies hieronder gewoon opnieuw.</p>
            </div>
          ) : null}

          <form action={submitPublicRsvpAction.bind(null, guest.id)} className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="submit"
                name="status"
                value="yes"
                className="chip-hover rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink-soft hover:border-success hover:bg-success-50 hover:text-success"
              >
                Ik kom
              </button>
              <button
                type="submit"
                name="status"
                value="maybe"
                className="chip-hover rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink-soft hover:border-ochre hover:bg-ochre-50 hover:text-ochre"
              >
                Misschien
              </button>
              <button
                type="submit"
                name="status"
                value="no"
                className="chip-hover rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink-soft hover:border-danger hover:bg-danger-50 hover:text-danger"
              >
                Kan niet
              </button>
            </div>

            <Field label="Aantal introducees" hint="Optioneel — alleen relevant als je komt">
              <Input type="number" name="plusOnes" min={0} max={20} defaultValue={guest.plusOnes} />
            </Field>
            <Field label="Dieetwensen of allergieën" hint="Optioneel">
              <Textarea name="dietaryNotes" rows={2} maxLength={500} defaultValue={guest.dietaryNotes ?? ""} placeholder="Bijv. vegetarisch, notenallergie..." />
            </Field>

            <p className="text-xs text-ink-faint">Klik op één van de knoppen hierboven om je antwoord (met eventuele introducees/dieetwensen) te versturen.</p>
          </form>
        </div>
      </div>
    </div>
  );
}
