import { notFound } from "next/navigation";
import { getEvent, getTimeline } from "@/lib/data/store";
import { EmptyState } from "@/components/ui/EmptyState";
import { AiTag } from "@/components/ui/Badge";
import { toggleTimelineAction } from "@/lib/actions/misc-actions";
import { formatDateNL } from "@/lib/utils";
import { CalendarClock, CheckCircle2, Circle } from "lucide-react";

export default async function TimelinePage(props: PageProps<"/events/[id]/timeline">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const rawTimeline = await getTimeline(id);
  const timeline = rawTimeline.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  if (timeline.length === 0) {
    return <EmptyState icon={<CalendarClock className="size-6" />} title="Nog geen planning" description="Zodra je AI-eventplan is gegenereerd, verschijnt hier automatisch een tijdlijn." />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-ink">Planning</h1>
          <p className="text-sm text-ink-faint">Automatisch gegenereerde tijdlijn voor {event.name}.</p>
        </div>
        <AiTag />
      </div>

      <div className="relative ml-3 space-y-0 border-l-2 border-line-soft pl-8">
        {timeline.map((item) => (
          <div key={item.id} className="relative pb-8 last:pb-0">
            <span className={`absolute -left-[41px] top-0.5 flex size-5 items-center justify-center rounded-full ${item.done ? "bg-success" : "bg-white border-2 border-line"}`}>
              {item.done && <CheckCircle2 className="size-3.5 text-white" />}
            </span>
            <p className="text-xs font-medium uppercase tracking-wide text-coral">{item.leadTimeLabel}</p>
            <form action={toggleTimelineAction.bind(null, id, item.id, !item.done)} className="mt-1">
              <button type="submit" className="flex items-center gap-2 text-left">
                {item.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-ink-faint" />}
                <span className={item.done ? "text-ink-faint line-through" : "font-medium text-ink"}>{item.title}</span>
              </button>
            </form>
            {item.dueDate && <p className="ml-6 mt-0.5 text-xs text-ink-faint">{formatDateNL(item.dueDate)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
