import Link from "next/link";
import { notFound } from "next/navigation";
import { findMatchingSuppliers, getEvent, getOffersForEvent, getRequestsForEvent, getRequirements } from "@/lib/data/store";
import { getSupplierById } from "@/lib/data/suppliers";
import { Card } from "@/components/ui/Card";
import { RequestCategoryCard } from "@/components/app/RequestCategoryCard";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { DeadlineCountdown } from "@/components/ui/Countdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { ArrowRight, Inbox } from "lucide-react";

export default async function RequestsPage(props: PageProps<"/events/[id]/requests">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [allRequirements, requests, offers] = await Promise.all([getRequirements(id), getRequestsForEvent(id), getOffersForEvent(id)]);
  const requirements = allRequirements.filter((r) => r.selected);

  if (requirements.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="size-6" />}
        title="Nog geen categorieën geselecteerd"
        description="Ga naar je AI-eventplan en selecteer de diensten die je nodig hebt om aanvragen te versturen."
        action={<LinkButton href={`/events/${id}/plan`}>Naar je eventplan</LinkButton>}
      />
    );
  }

  const notRequested = requirements.filter((r) => r.status === "selected" || r.status === "suggested");
  const awaiting = requirements.filter((r) => r.status === "requested" || r.status === "awaiting_response");
  const resolved = requirements.filter((r) => ["offers_received", "shortlisted", "confirmed", "paid", "completed"].includes(r.status));

  return (
    <div className="space-y-10">
      {notRequested.length > 0 && (
        <section>
          <h2 className="mb-1 font-display text-lg text-ink">Klaar om aan te vragen</h2>
          <p className="mb-4 text-sm text-ink-faint">We selecteren automatisch de 3-5 best passende leveranciers — zo voorkomen we spam bij aanbieders.</p>
          <div className="space-y-3">
            {notRequested.map((r) => {
              const matches = findMatchingSuppliers(r.categoryKey, { locationLabel: event.locationLabel, limit: 4 }).map((m) => ({
                id: m.supplier.id,
                companyName: m.supplier.companyName,
                avgPriceCents: m.supplier.avgPriceCents,
                ratingAvg: m.supplier.ratingAvg,
                verified: m.supplier.verified,
                photoGradient: m.supplier.photoGradient,
                initials: m.supplier.initials,
                matchScore: m.score,
              }));
              return (
                <RequestCategoryCard
                  key={r.id}
                  eventId={id}
                  categoryKey={r.categoryKey}
                  label={r.label}
                  defaultBudgetCents={r.estimatedBudgetCents}
                  initialMessage={r.draftMessage}
                  matches={matches}
                />
              );
            })}
          </div>
        </section>
      )}

      {awaiting.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg text-ink">Wacht op reactie</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {awaiting.map((r) => {
              const req = requests.find((rq) => rq.categoryKey === r.categoryKey);
              return (
                <Card key={r.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{r.label}</p>
                      {req && <DeadlineCountdown deadlineIso={req.deadlineAt} className="mt-1" />}
                    </div>
                    <div className="flex -space-x-2.5">
                      {req?.supplierIds.slice(0, 4).map((sid) => {
                        const s = getSupplierById(sid);
                        if (!s) return null;
                        return <SupplierAvatar key={sid} gradient={s.photoGradient} initials={s.initials} size={32} verified={s.verified} className="ring-2 ring-white" />;
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg text-ink">Offertes ontvangen</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {resolved.map((r) => {
              const categoryOffers = offers.filter((o) => o.categoryKey === r.categoryKey);
              return (
                <Link
                  key={r.id}
                  href={`/events/${id}/offers/${r.categoryKey}`}
                  className="card-hover flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-4 hover:border-clay/50"
                >
                  <div>
                    <p className="font-medium text-ink">{r.label}</p>
                    <p className="text-sm text-ink-faint">{categoryOffers.length} offerte{categoryOffers.length !== 1 ? "s" : ""} ontvangen</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-clay">
                    Bekijken <ArrowRight className="size-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
