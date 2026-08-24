import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Select } from "@/components/ui/Form";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { CategoryIconBar } from "@/components/app/CategoryIconBar";
import { SupplierMap } from "@/components/ui/SupplierMap";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSpotlightSupplierIds, searchSupplierAccounts } from "@/lib/data/store";
import { saveSearchAction } from "@/lib/actions/misc-actions";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { SUBSCRIPTION_TIERS, formatCurrency } from "@/lib/config";
import { BookmarkPlus, CheckCircle2, Crown, Flashlight, List, Map as MapIcon, MapPin, Search, ShieldCheck, Sparkles, Star } from "lucide-react";

export const metadata = { title: "Leveranciers zoeken — Vyra" };

export default async function SupplierDirectoryPage(props: PageProps<"/leveranciers">) {
  const params = await props.searchParams;
  const category = typeof params.category === "string" && params.category ? (params.category as SupplierCategory) : undefined;
  const location = typeof params.location === "string" ? params.location.trim() : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const minPriceEuros = typeof params.minPrice === "string" && params.minPrice ? Number(params.minPrice) : undefined;
  const maxPriceEuros = typeof params.maxPrice === "string" && params.maxPrice ? Number(params.maxPrice) : undefined;

  const unsortedSuppliers = await searchSupplierAccounts({
    category,
    location: location || undefined,
    query: q || undefined,
    minPriceCents: minPriceEuros != null && Number.isFinite(minPriceEuros) ? Math.round(minPriceEuros * 100) : undefined,
    maxPriceCents: maxPriceEuros != null && Number.isFinite(maxPriceEuros) ? Math.round(maxPriceEuros * 100) : undefined,
  });

  // Spotlight (leverancier heeft zelf tijdelijk een categorie "uitgelicht",
  // zie SpotlightPanel.tsx): boven aan de resultaten + een badge. Bij een
  // categoriefilter telt alleen een spotlight VOOR precies die categorie
  // mee — anders elke actieve spotlight van de leverancier.
  const spotlightedIds = await getActiveSpotlightSupplierIds(unsortedSuppliers.map((s) => s.id), category);
  const suppliers = [...unsortedSuppliers].sort((a, b) => {
    const aSpot = spotlightedIds.has(a.id) ? 1 : 0;
    const bSpot = spotlightedIds.has(b.id) ? 1 : 0;
    return bSpot - aSpot;
  });

  const hasFilters = Boolean(category || location || q || minPriceEuros || maxPriceEuros);
  const searchSaved = params.searchSaved === "1";
  const user = await getCurrentUser();

  // "Locatie op een kaart" (spec-item, Airbnb-geïnspireerd) — naast de
  // bestaande lijstweergave een kaartweergave, vooral fijn voor
  // locatiegebonden diensten. Via een querystring-param i.p.v. client-state,
  // zodat deze pagina een server component kan blijven (net als de rest van
  // de filters hier) en een gedeelde link met ?view=kaart meteen de kaart
  // toont.
  const view = params.view === "kaart" ? "kaart" : "lijst";

  // Categorie-iconenbalk (CategoryIconBar) behoudt de overige actieve
  // filters bij het wisselen van categorie — alleen `category` verandert.
  function buildCategoryHref(cat?: SupplierCategory) {
    const qs = new URLSearchParams();
    if (cat) qs.set("category", cat);
    if (location) qs.set("location", location);
    if (q) qs.set("q", q);
    if (minPriceEuros != null && Number.isFinite(minPriceEuros)) qs.set("minPrice", String(minPriceEuros));
    if (maxPriceEuros != null && Number.isFinite(maxPriceEuros)) qs.set("maxPrice", String(maxPriceEuros));
    if (view === "kaart") qs.set("view", "kaart");
    const query = qs.toString();
    return `/leveranciers${query ? `?${query}` : ""}`;
  }

  function buildViewHref(v: "lijst" | "kaart") {
    const qs = new URLSearchParams();
    if (category) qs.set("category", category);
    if (location) qs.set("location", location);
    if (q) qs.set("q", q);
    if (minPriceEuros != null && Number.isFinite(minPriceEuros)) qs.set("minPrice", String(minPriceEuros));
    if (maxPriceEuros != null && Number.isFinite(maxPriceEuros)) qs.set("maxPrice", String(maxPriceEuros));
    if (v === "kaart") qs.set("view", "kaart");
    const query = qs.toString();
    return `/leveranciers${query ? `?${query}` : ""}`;
  }

  const suppliersWithCoords = suppliers.filter((s) => s.lat != null && s.lng != null);
  const suppliersWithoutCoords = suppliers.length - suppliersWithCoords.length;

  const main = (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-ink">Leveranciers zoeken</h1>
        <p className="mt-1 text-ink-soft">Filter op categorie, prijs en werkgebied — of beschrijf gewoon wat je zoekt.</p>

        <div className="mt-6">
          <CategoryIconBar activeCategory={category} buildHref={buildCategoryHref} />
        </div>

        <Card className="mt-4">
          <form method="get" action="/leveranciers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
              <button type="submit" className="lift-hover inline-flex items-center gap-1.5 rounded-xl bg-clay px-5 py-2.5 text-sm font-medium text-white hover:bg-clay-dark">
                <Search className="size-4" /> Zoeken
              </button>
              {hasFilters && (
                <Link href="/leveranciers" className="text-sm font-medium text-ink-faint hover:text-ink">Filters wissen</Link>
              )}
            </div>
          </form>
          {user && (
            // Los van het filterformulier hierboven — HTML staat geen
            // geneste <form>s toe. Geeft dezelfde filters mee als verborgen
            // velden, zodat "Bewaren" altijd de zoekopdracht bewaart die nu
            // op het scherm staat.
            <form action={saveSearchAction} className="mt-3 flex justify-end border-t border-line-soft pt-3">
              <input type="hidden" name="category" value={category ?? ""} />
              <input type="hidden" name="location" value={location} />
              <input type="hidden" name="q" value={q} />
              <button type="submit" className="chip-hover inline-flex items-center gap-1.5 text-sm font-medium text-sage hover:underline">
                <BookmarkPlus className="size-4" /> Bewaar deze zoekopdracht
              </button>
            </form>
          )}
        </Card>

        {searchSaved && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>
              Bewaard — je krijgt een melding zodra een nieuwe leverancier hierbij past. Bekijk al je bewaarde zoekopdrachten op{" "}
              <Link href="/mijn-leveranciers" className="underline">Mijn leveranciers</Link>.
            </span>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-faint">
            {suppliers.length === 0 ? "Geen leveranciers gevonden" : `${suppliers.length} leverancier${suppliers.length !== 1 ? "s" : ""} gevonden`}
            {location && ` in de buurt van "${location}"`}.
          </p>
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white p-1">
            <Link
              href={buildViewHref("lijst")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "lijst" ? "bg-clay text-white" : "text-ink-soft hover:bg-paper-dim"}`}
            >
              <List className="size-3.5" /> Lijst
            </Link>
            <Link
              href={buildViewHref("kaart")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "kaart" ? "bg-clay text-white" : "text-ink-soft hover:bg-paper-dim"}`}
            >
              <MapIcon className="size-3.5" /> Kaart
            </Link>
          </div>
        </div>

        {suppliers.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-6 py-14 text-center text-ink-faint">
            Geen leveranciers gevonden met deze filters. Probeer een ruimere zoekopdracht of wis de filters.
          </div>
        ) : view === "kaart" ? (
          <div className="mt-4">
            <SupplierMap
              className="overflow-hidden rounded-2xl border border-line [box-shadow:var(--shadow-card)]"
              height="32rem"
              markers={suppliersWithCoords.map((s) => ({
                id: s.id,
                lat: s.lat!,
                lng: s.lng!,
                label: s.companyName,
                sub: `${SUPPLIER_CATEGORY_LABELS[s.category]} · vanaf ${formatCurrency(s.minPriceCents)}`,
                href: `/leveranciers/${s.id}`,
              }))}
            />
            {suppliersWithoutCoords > 0 && (
              <p className="mt-3 text-xs text-ink-faint">
                {suppliersWithoutCoords} van de {suppliers.length} gevonden leverancier{suppliersWithoutCoords !== 1 ? "s" : ""} {suppliersWithoutCoords === 1 ? "staat" : "staan"} niet op de kaart
                (locatie kon niet automatisch worden gevonden) — nog wel te zien in de lijstweergave.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((s) => (
              <Link
                key={s.id}
                href={`/leveranciers/${s.id}`}
                className="card-hover block rounded-2xl border border-line bg-white p-5 hover:border-clay/50 [box-shadow:var(--shadow-card)]"
              >
                <div className="flex items-start gap-3">
                  <SupplierAvatar
                    gradient={["#E8C9A8", "#B5674A"]}
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
                          <Star className="size-3 fill-ochre text-ochre" /> {s.ratingAvg.toFixed(1)} ({s.ratingCount})
                        </>
                      ) : (
                        <span>Nog geen reviews</span>
                      )}
                      {s.verified && <ShieldCheck className="ml-1 size-3 text-sage" />}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {/*
                    Badge o.b.v. het GEKOZEN abonnementsniveau (spec-item #53-vervolg,
                    SaaS-pivot) — niet de effectieve laag inclusief proefperiode, want
                    dat zou hier een aparte databasequery per leverancier vergen. Op het
                    eigen leveranciersprofiel/openbare profielpagina wordt wel de
                    effectieve laag gebruikt (zie app/leveranciers/[id]/page.tsx).
                  */}
                  {spotlightedIds.has(s.id) && (
                    <Badge tone="ochre" icon={<Flashlight className="size-3" />}>Uitgelicht</Badge>
                  )}
                  {SUBSCRIPTION_TIERS[s.subscriptionTier].badge === "elite" && (
                    <Badge tone="clay" icon={<Crown className="size-3" />}>Elite Partner</Badge>
                  )}
                  {SUBSCRIPTION_TIERS[s.subscriptionTier].badge === "aanbevolen" && (
                    <Badge tone="ochre" icon={<Sparkles className="size-3" />}>Aanbevolen</Badge>
                  )}
                  {s.categories.slice(0, 3).map((c) => (
                    <Badge key={c} tone="sage">{SUPPLIER_CATEGORY_LABELS[c]}</Badge>
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
  );

  if (user) {
    return (
      <div className="min-h-screen bg-paper">
        <AppTopBar />
        {main}
      </div>
    );
  }

  return (
    <>
      <MarketingHeader />
      {main}
      <Footer />
    </>
  );
}
