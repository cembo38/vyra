import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { computeReadiness, getBudgetSummary, listEventsForUser } from "@/lib/data/store";
import { CardHover } from "@/components/ui/Card";
import { StageBadge } from "@/components/ui/Badge";
import { EventCountdown } from "@/components/ui/Countdown";
import { EventDateQuickAdd } from "@/components/app/EventDateQuickAdd";
import { ReadinessRing } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { EVENT_TYPE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/config";
import { formatDateNL } from "@/lib/utils";
import { CalendarHeart, MapPin, Sparkles, Users } from "lucide-react";

export default async function MyEventsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const events = await listEventsForUser(user.id);
  const cards = await Promise.all(
    events.map(async (event) => ({ event, readiness: await computeReadiness(event.id), budget: await getBudgetSummary(event.id) }))
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Welkom terug, {user.firstName || "daar"}</h1>
          <p className="mt-1.5 text-ink-soft">Al je evenementen, plannen en aanbiedingen op één plek.</p>
        </div>
        <LinkButton href="/events/new" icon={<Sparkles className="size-4" />}>
          Nieuw evenement
        </LinkButton>
      </div>

      {events.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Je hebt nog geen evenementen"
            description="Vertel onze AI wat je wilt organiseren en krijg binnen een paar minuten een compleet plan."
            action={<LinkButton href="/events/new">Start mijn evenement</LinkButton>}
          />
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ event, readiness, budget }) => {
            const guests = (event.guestCountAdults ?? 0) + (event.guestCountChildren ?? 0);
            return (
              <Link key={event.id} href={`/events/${event.id}`}>
                <CardHover className={event.stage === "cancelled" ? "h-full opacity-60" : "h-full"}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">{EVENT_TYPE_LABELS[event.type]}</span>
                      <h2 className="mt-1 font-display text-xl leading-snug text-ink">{event.name}</h2>
                    </div>
                    <ReadinessRing value={readiness.score} size={52} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StageBadge stage={event.stage} />
                  </div>

                  <div className="mt-5 space-y-2 text-sm text-ink-soft">
                    <div className="flex items-center gap-2">
                      {event.date ? (
                        <>
                          <CalendarHeart className="size-4 text-ink-faint" />
                          {formatDateNL(event.date)}
                        </>
                      ) : (
                        <EventDateQuickAdd eventId={event.id} stopPropagation />
                      )}
                    </div>
                    {event.locationLabel && (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-ink-faint" />
                        {event.locationLabel}
                      </div>
                    )}
                    {guests > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="size-4 text-ink-faint" />
                        {guests} gasten
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-line-soft pt-4 text-sm">
                    <EventCountdown dateIso={event.date} />
                    {event.budget && <span className="font-medium text-ink">{formatCurrency(budget.totalCents)}</span>}
                  </div>
                </CardHover>
              </Link>
            );
          })}

          <Link href="/events/new">
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-line text-center text-ink-faint transition-colors hover:border-clay/50 hover:text-clay">
              <Sparkles className="size-6" />
              <p className="mt-3 text-sm font-medium">Nieuw evenement starten</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
