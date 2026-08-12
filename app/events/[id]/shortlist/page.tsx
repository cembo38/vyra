import Link from "next/link";
import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getEvent, getOffersForEvent, getRequirements } from "@/lib/data/store";
import { getSupplierById } from "@/lib/data/suppliers";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/config";
import { CheckCircle2, Heart, Hourglass, Sparkles, XCircle } from "lucide-react";

export default async function ShortlistPage(props: PageProps<"/events/[id]/shortlist">) {
  const { id } = await props.params;
  const event = getEvent(id);
  if (!event) notFound();

  const requirements = getRequirements(id).filter((r) => r.selected);
  const offers = getOffersForEvent(id);

  if (requirements.length === 0) {
    return (
      <EmptyState
        icon={<Heart className="size-6" />}
        title="Nog geen shortlist"
        description="Zodra je offertes ontvangt en begint met swipen, verschijnen je favorieten hier."
        action={<LinkButton href={`/events/${id}/plan`}>Naar je eventplan</LinkButton>}
      />
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink">Mijn shortlist</h1>
      <p className="mb-6 text-sm text-ink-faint">Overzicht van je keuzes per categorie voor {event.name}.</p>

      <Card className="divide-y divide-line-soft p-0">
        {requirements.map((r) => {
          const categoryOffers = offers.filter((o) => o.categoryKey === r.categoryKey);
          const accepted = categoryOffers.find((o) => o.status === "accepted");
          const shortlisted = categoryOffers.filter((o) => o.swipeDecision === "shortlisted" && o.status !== "accepted");
          const rejected = categoryOffers.filter((o) => o.swipeDecision === "rejected");

          let rows: { icon: ReactNode; label: string; sub: string; href: string }[] = [];

          if (accepted) {
            const s = getSupplierById(accepted.supplierId);
            rows.push({ icon: <CheckCircle2 className="size-5 text-success" />, label: s?.companyName ?? "Leverancier", sub: `Geselecteerd · ${formatCurrency(accepted.totalPriceCents)}`, href: `/events/${id}/offers/${r.categoryKey}` });
          } else if (shortlisted.length > 0) {
            rows = shortlisted.map((o) => {
              const s = getSupplierById(o.supplierId);
              return { icon: <Heart className="size-5 text-coral" />, label: s?.companyName ?? "Leverancier", sub: `Op shortlist · ${formatCurrency(o.totalPriceCents)}`, href: `/events/${id}/offers/${r.categoryKey}` };
            });
          } else if (categoryOffers.length > 0) {
            rows.push({ icon: <Sparkles className="size-5 text-violet" />, label: r.label, sub: `${categoryOffers.length} offerte(s) nog te bekijken`, href: `/events/${id}/offers/${r.categoryKey}` });
          } else {
            rows.push({ icon: <Hourglass className="size-5 text-gold" />, label: r.label, sub: "Wachten op reactie van leveranciers", href: `/events/${id}/requests` });
          }

          return (
            <div key={r.id} className="px-6 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{r.label}</p>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <Link key={i} href={row.href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-paper-dim">
                    {row.icon}
                    <div>
                      <p className="text-sm font-medium text-ink">{row.label}</p>
                      <p className="text-xs text-ink-faint">{row.sub}</p>
                    </div>
                  </Link>
                ))}
                {rejected.length > 0 && (
                  <p className="flex items-center gap-2 px-2 text-xs text-ink-faint">
                    <XCircle className="size-3.5" /> {rejected.length} afgewezen
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
