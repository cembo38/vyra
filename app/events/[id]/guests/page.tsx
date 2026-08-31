import { notFound } from "next/navigation";
import { getEvent, getGuestsForEvent, summarizeGuests } from "@/lib/data/store";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { AddGuestForm } from "@/components/app/AddGuestForm";
import { CopyRsvpLinkButton } from "@/components/app/CopyRsvpLinkButton";
import { updateGuestRsvpAction, deleteGuestAction } from "@/lib/actions/guest-actions";
import { RsvpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Trash2, Users } from "lucide-react";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata = { title: "Gasten — Vyra" };

const STATUS_OPTIONS: { status: RsvpStatus; label: string }[] = [
  { status: "yes", label: "Komt" },
  { status: "maybe", label: "Misschien" },
  { status: "no", label: "Komt niet" },
  { status: "pending", label: "Onbekend" },
];

const STATUS_TONE: Record<RsvpStatus, string> = {
  yes: "bg-success text-white",
  maybe: "bg-ochre text-white",
  no: "bg-danger text-white",
  pending: "bg-paper-dim text-ink-soft",
};

export default async function GuestsPage(props: PageProps<"/events/[id]/guests">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const guests = await getGuestsForEvent(id);
  const summary = summarizeGuests(guests);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Gastenlijst</h1>
          <p className="mt-1 text-sm text-ink-faint">Beheer je gasten en houd RSVP&apos;s bij voor {event.name}.</p>
        </div>
        <AddGuestForm eventId={id} />
      </div>

      {guests.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="Nog geen gasten toegevoegd"
          description="Voeg gasten één voor één toe, of plak in één keer een hele lijst met namen. Elke gast krijgt een eigen RSVP-link die je zelf kunt versturen."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryTile label="Genodigd" value={summary.invited} />
            <SummaryTile label="Komt" value={summary.yes} tone="text-success" />
            <SummaryTile label="Misschien" value={summary.maybe} tone="text-ochre" />
            <SummaryTile label="Komt niet" value={summary.no} tone="text-danger" />
            <SummaryTile label="Totaal incl. introducees" value={summary.total} tone="text-ink" />
          </div>

          <Card className="divide-y divide-line-soft p-0">
            {guests.map((guest) => (
              <div key={guest.id} className="flex flex-col items-start gap-3 px-5 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{guest.name}</span>
                    {guest.groupLabel && <Badge tone="neutral">{guest.groupLabel}</Badge>}
                    {guest.rsvpStatus === "yes" && guest.plusOnes > 0 && (
                      <span className="text-xs text-ink-faint">+{guest.plusOnes} introducee{guest.plusOnes > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {(guest.email || guest.phone) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-faint">
                      {guest.email && <span>{guest.email}</span>}
                      {guest.phone && <span>{guest.phone}</span>}
                    </div>
                  )}
                  {guest.dietaryNotes && <p className="mt-0.5 text-xs text-ink-faint">✦ {guest.dietaryNotes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full border border-line bg-white p-0.5">
                    {STATUS_OPTIONS.map((o) => (
                      <form key={o.status} action={updateGuestRsvpAction.bind(null, id, guest.id)}>
                        <input type="hidden" name="rsvpStatus" value={o.status} />
                        <SubmitButton
                          pendingLabel="Bezig…"
                          className={cn(
                            "chip-hover rounded-full px-2.5 py-1 text-xs font-medium",
                            guest.rsvpStatus === o.status ? STATUS_TONE[o.status] : "text-ink-faint"
                          )}
                        >
                          {o.label}
                        </SubmitButton>
                      </form>
                    ))}
                  </div>
                  <CopyRsvpLinkButton guestId={guest.id} />
                  <form action={deleteGuestAction.bind(null, id, guest.id)}>
                    <SubmitButton
                      iconOnly
                      aria-label="Gast verwijderen"
                      className="icon-pop flex size-10 items-center justify-center rounded-full text-ink-faint hover:bg-danger-50 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-white px-3 py-3 text-center">
      <p className={cn("font-display text-xl", tone ?? "text-ink")}>{value}</p>
      <p className="mt-0.5 text-xs text-ink-faint">{label}</p>
    </div>
  );
}
