import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEvent } from "@/lib/data/store";
import { Card } from "@/components/ui/Card";
import { StageBadge } from "@/components/ui/Badge";
import { CloseEventButton } from "@/components/app/CloseEventButton";
import { DeleteEventButton } from "@/components/app/DeleteEventButton";

export default async function EventSettingsPage(props: PageProps<"/events/[id]/settings">) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(id);
  if (!event) notFound();
  if (event.ownerId !== user.id) redirect("/events");

  const cancelled = event.stage === "cancelled";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl tracking-tight text-ink">Instellingen</h1>
        <p className="mt-1 text-sm text-ink-soft">Beheer de status van dit evenement.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Status</p>
            <p className="mt-1 text-sm text-ink-faint">
              {cancelled
                ? "Dit evenement is gesloten. Het blijft bewaard, maar je krijgt er geen herinneringen meer over (verlopen reactietermijnen, deadlines, budget)."
                : "Sluit dit evenement als je er niet meer actief mee bezig bent. Al je gegevens blijven bewaard en je kunt het op elk moment weer heropenen."}
            </p>
          </div>
          <StageBadge stage={event.stage} />
        </div>
        <div className="mt-4">
          <CloseEventButton eventId={event.id} cancelled={cancelled} />
        </div>
      </Card>

      <Card className="border-danger/20">
        <p className="text-sm font-medium text-ink">Gevarenzone</p>
        <p className="mt-1 text-sm text-ink-faint">
          Verwijder dit evenement definitief, inclusief het plan, alle aanvragen, offertes, berichten, betalingen en de gastenlijst.
          Dit kan niet ongedaan worden gemaakt.
        </p>
        <div className="mt-4">
          <DeleteEventButton eventId={event.id} eventName={event.name} />
        </div>
      </Card>
    </div>
  );
}
