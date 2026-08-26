import Link from "next/link";
import { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getEvent, getOffersForEvent, getPaymentsForOffer, getRequirements, getReviewsForOffer, isSupplierFavorited, resolveSupplierDisplay } from "@/lib/data/store";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { FavoriteSupplierButton } from "@/components/app/FavoriteSupplierButton";
import { ReviewComposer } from "@/components/app/ReviewComposer";
import { formatCurrency, REVIEW_REVEAL_WINDOW_DAYS } from "@/lib/config";
import { isReviewRevealed } from "@/lib/utils";
import { CheckCircle2, Heart, Hourglass, Sparkles, XCircle } from "lucide-react";

export default async function ShortlistPage(props: PageProps<"/events/[id]/shortlist">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [allRequirements, offers] = await Promise.all([getRequirements(id), getOffersForEvent(id)]);
  const requirements = allRequirements.filter((r) => r.selected);

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
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <h1 className="font-display text-2xl text-ink">Mijn shortlist</h1>
        {/* Kruislink met de globale favorietenlijst (livegang-audit) — tot
            nu toe twee losse eilandjes: hier je keuzes vóór dít evenement,
            op /mijn-leveranciers je bewaarde favorieten over al je
            evenementen heen. */}
        <Link href="/mijn-leveranciers" className="flex items-center gap-1.5 text-sm font-medium text-clay hover:underline">
          <Heart className="size-3.5" /> Mijn opgeslagen leveranciers
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-faint">Overzicht van je keuzes per categorie voor {event.name}.</p>

      <Card className="divide-y divide-line-soft p-0">
        {await Promise.all(requirements.map(async (r) => {
          const categoryOffers = offers.filter((o) => o.categoryKey === r.categoryKey);
          const accepted = categoryOffers.find((o) => o.status === "accepted");
          const shortlisted = categoryOffers.filter((o) => o.swipeDecision === "shortlisted" && o.status !== "accepted");
          const rejected = categoryOffers.filter((o) => o.swipeDecision === "rejected");

          let rows: { icon: ReactNode; label: string; sub: string; href: string; supplierId?: string; favorited?: boolean }[] = [];
          let reviewBlock: ReactNode = null;

          if (accepted) {
            const s = await resolveSupplierDisplay(accepted.supplierId);
            // Zodra er een betaling voor deze boeking bestaat, is de
            // checkout-/betaalpagina de nuttigere bestemming (daar staat de
            // betaalstatus én, sinds spec-item #50, een link om een
            // geschil te melden) — anders is er nog niets te betalen en
            // blijft de offertepagina de juiste plek.
            const payments = await getPaymentsForOffer(accepted.id);
            const primaryPayment = payments.find((p) => p.installment !== "balance") ?? payments[0];
            const href = primaryPayment ? `/events/${id}/checkout/${primaryPayment.id}` : `/events/${id}/offers/${r.categoryKey}`;
            const favorited = await isSupplierFavorited(accepted.supplierId);
            rows.push({ icon: <CheckCircle2 className="size-5 text-success" />, label: s?.companyName ?? "Leverancier", sub: `Geselecteerd · ${formatCurrency(accepted.totalPriceCents)}`, href, supplierId: accepted.supplierId, favorited });

            // Wederzijdse beoordelingen (spec-item, Airbnb-geïnspireerd) —
            // pas zinvol zodra de evenementdatum echt is geweest, zelfde
            // "< vandaag"-grens als de aankomend/afgerond-indeling op de
            // orders-pagina van een leverancier.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (event.date && new Date(event.date) < today) {
              const reviews = await getReviewsForOffer(accepted.id);
              const ownReview = reviews.find((rv) => rv.reviewerRole === "organizer") ?? null;
              const counterpartReview = reviews.find((rv) => rv.reviewerRole === "supplier") ?? null;
              const revealed = isReviewRevealed(Boolean(ownReview), Boolean(counterpartReview), event.date, REVIEW_REVEAL_WINDOW_DAYS);
              reviewBlock = (
                <ReviewComposer
                  offerId={accepted.id}
                  reviewerRole="organizer"
                  ownReview={ownReview}
                  counterpartReview={counterpartReview}
                  counterpartLabel={s?.companyName ?? "de leverancier"}
                  revealed={revealed}
                />
              );
            }
          } else if (shortlisted.length > 0) {
            rows = await Promise.all(shortlisted.map(async (o) => {
              const [s, favorited] = await Promise.all([resolveSupplierDisplay(o.supplierId), isSupplierFavorited(o.supplierId)]);
              return { icon: <Heart className="size-5 text-clay" />, label: s?.companyName ?? "Leverancier", sub: `Op shortlist · ${formatCurrency(o.totalPriceCents)}`, href: `/events/${id}/offers/${r.categoryKey}`, supplierId: o.supplierId, favorited };
            }));
          } else if (categoryOffers.length > 0) {
            rows.push({ icon: <Sparkles className="size-5 text-sage" />, label: r.label, sub: `${categoryOffers.length} offerte(s) nog te bekijken`, href: `/events/${id}/offers/${r.categoryKey}` });
          } else {
            rows.push({ icon: <Hourglass className="size-5 text-ochre" />, label: r.label, sub: "Wachten op reactie van leveranciers", href: `/events/${id}/requests` });
          }

          return (
            <div key={r.id} className="px-6 py-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">{r.label}</p>
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-1 rounded-xl transition-colors hover:bg-paper-dim">
                    <Link href={row.href} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-1.5">
                      {row.icon}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{row.label}</p>
                        <p className="text-xs text-ink-faint">{row.sub}</p>
                      </div>
                    </Link>
                    {/* Kruislink met /mijn-leveranciers: een leverancier
                        rechtstreeks vanaf de shortlist als favoriet
                        opslaan, zonder eerst naar zijn profiel te hoeven. */}
                    {row.supplierId && (
                      <div className="pr-2">
                        <FavoriteSupplierButton supplierId={row.supplierId} initialFavorited={row.favorited ?? false} />
                      </div>
                    )}
                  </div>
                ))}
                {rejected.length > 0 && (
                  <p className="flex items-center gap-2 px-2 text-xs text-ink-faint">
                    <XCircle className="size-3.5" /> {rejected.length} afgewezen
                  </p>
                )}
              </div>
              {reviewBlock}
            </div>
          );
        }))}
      </Card>
    </div>
  );
}
