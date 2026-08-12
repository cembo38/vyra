import { notFound } from "next/navigation";
import { getEvent, getOffersForEvent } from "@/lib/data/store";
import { getSupplierById } from "@/lib/data/suppliers";
import { OfferBrowser, OfferWithSupplier } from "@/components/app/OfferBrowser";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";

export default async function CategoryOffersPage(props: PageProps<"/events/[id]/offers/[category]">) {
  const { id, category } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const categoryKey = category as SupplierCategory;
  const label = SUPPLIER_CATEGORY_LABELS[categoryKey];
  if (!label) notFound();

  const rawOffers = await getOffersForEvent(id, categoryKey);
  const offers: OfferWithSupplier[] = rawOffers
    .map((o) => {
      const supplier = getSupplierById(o.supplierId);
      if (!supplier) return null;
      return { ...o, supplier };
    })
    .filter(Boolean) as OfferWithSupplier[];

  offers.sort((a, b) => b.matchScore - a.matchScore);

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink">{label}</h1>
      <p className="mb-6 text-sm text-ink-faint">Vergelijk en kies de leverancier die het beste bij je evenement past.</p>
      <OfferBrowser offers={offers} categoryLabel={label} />
    </div>
  );
}
