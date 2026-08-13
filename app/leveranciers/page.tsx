import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Form";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { searchSupplierAccounts } from "@/lib/data/store";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { formatCurrency } from "@/lib/config";
import { MapPin, Search, ShieldCheck, Star } from "lucide-react";

export const metadata = { title: "Leveranciers zoeken — Vyra" };

export default async function SupplierDirectoryPage(props: PageProps<"/leveranciers">) {
  const params = await props.searchParams;
  const category = typeof params.category === "string" && params.category ? (params.category as SupplierCategory) : undefined;
  const location = typeof params.location === "string" ? params.location.trim() : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const minPriceEuros = typeof params.minPrice === "string" && params.minPrice ? Number(params.minPrice) : undefined;
  const maxPriceEuros = typeof params.maxPrice === "string" && params.maxPrice ? Number(params.maxPrice) : undefined;

  const suppliers = await searchSupplierAccounts({
    category,
    location: location || undefined,
    query: q || undefined,
    minPriceCents: minPriceEuros != null && Number.isFinite(minPriceEuros) ? Math.round(minPriceEuros * 100) : undefined,
    maxPriceCents: maxPriceEuros != null && Number.isFinite(maxPriceEuros) ? Math.round(maxPriceEuros * 100) : undefined,
  });

  const hasFilters = Boolean(category || location || q || minPriceEuros || maxPriceEuros);

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-ink">Leveranciers zoeken</h1>
        <p className="mt-1 text-ink-soft">Filter op categorie, prijs en werkgebied — of beschrijf gewoon wat je zoekt.</p>

        <Card className="mt-6">
          <form method="get" action="/leveranciers" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Wat zoek je?" hint="Bijv. 'live band voor bruiloft'">
              <Input name="q" defaultValue={q} placeholder="Zoekterm..." />
            </Field>
            <Field label="Categorie">
              <Select name="category" defaultValue={category ?? ""}>
                <option value="">Alle categorieën</option>
                {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Plaats / regio" hint="Werkgebied van de leverancier">
              <Input name="location" defaultValue={location} placeholder="Bijv. Utrecht" />
            </Field>
            <Field label="Prijs vanaf (€)">
              <Input name="minPrice" type="number" min={0} step={1} defaultValue={minPriceEuros ?? ""} />
            </Field>
            <Field label="Prijs tot (€)">
              <Input name="maxPrice" type="number" min={0} step={1} defaultValue={maxPriceEuros ?? ""} />
            </Field>
            <div className="sm:col-span-2 lg:col-span-5 flex items-center gap-3">
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-full bg-coral px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-dark">
                <Search className="size-4" /> Zoeken
              </button>
              {hasFilters && (
                <Link href="/leveranciers" className="text-sm font-medium text-ink-faint hover:text-ink">Filters wissen</Link>
              )}
            </div>
          </form>
        </Card>

        <p className="mt-6 text-sm text-ink-faint">
          {suppliers.length === 0 ? "Geen leveranciers gevonden" : `${suppliers.length} leverancier${suppliers.length !== 1 ? "s" : ""} gevonden`}
          {location && ` in de buurt van "${location}"`}.
        </p>

        {suppliers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-faint">
            Geen leveranciers gevonden met deze filters. Probeer een ruimere zoekopdracht of wis de filters.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <Link
                key={s.id}
                href={`/leveranciers/${s.id}`}
                className="block rounded-2xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-coral/50 [box-shadow:var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <SupplierAvatar
                    gradient={["#C7B8FF", "#6D5CF0"]}
                    initials={s.companyName.slice(0, 2).toUpperCase()}
                    imageUrl={s.logoUrl}
                    verified={s.verified}
                    size={48}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{s.companyName}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                      {s.ratingCount > 0 ? (
                        <>
                          <Star className="size-3 fill-gold text-gold" /> {s.ratingAvg.toFixed(1)} ({s.ratingCount})
                        </>
                      ) : (
                        <span>Nog geen reviews</span>
                      )}
                      {s.verified && <ShieldCheck className="ml-1 size-3 text-violet" />}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.categories.slice(0, 3).map((c) => (
                    <Badge key={c} tone="violet">{SUPPLIER_CATEGORY_LABELS[c]}</Badge>
                  ))}
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{s.description}</p>

                <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-sm">
                  <span className="flex items-center gap-1 text-ink-faint"><MapPin className="size-3.5" /> {s.baseLocation || "Onbekend"}</span>
                  <span className="font-medium text-ink">vanaf {formatCurrency(s.minPriceCents)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
