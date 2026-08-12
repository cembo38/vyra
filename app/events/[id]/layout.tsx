import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getEvent } from "@/lib/data/store";
import { EventSubNav } from "@/components/app/EventSubNav";
import { StageBadge } from "@/components/ui/Badge";
import { EventCountdown } from "@/components/ui/Countdown";
import { EVENT_TYPE_LABELS } from "@/lib/types";

export default async function EventLayout(props: LayoutProps<"/events/[id]">) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const event = await getEvent(id);

  if (!event) notFound();
  if (event.ownerId !== user.id) redirect("/events");

  return (
    <div>
      <div className="border-b border-line-soft bg-white">
        <div className="mx-auto max-w-6xl px-6 pb-5 pt-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{EVENT_TYPE_LABELS[event.type]}</span>
              <h1 className="mt-1 font-display text-2xl tracking-tight text-ink sm:text-3xl">{event.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <StageBadge stage={event.stage} />
                <EventCountdown dateIso={event.date} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <EventSubNav eventId={event.id} />
      <div className="mx-auto max-w-6xl px-6 py-8">{props.children}</div>
    </div>
  );
}
