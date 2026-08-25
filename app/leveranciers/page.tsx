import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { AppTopBar } from "@/components/app/AppTopBar";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { CategoryIconBar } from "@/components/app/CategoryIconBar";
import { SupplierMap } from "@/components/ui/SupplierMap";
import { SupplierFilterPanel } from "@/components/app/SupplierFilterPanel";
import { MobileFilterDrawer } from "@/components/app/MobileFilterDrawer";
import { SupplierCategoryFilterItem } from "@/components/app/SupplierCategoryFilterList";
import { SUPPLIER_CATEGORY_ICONS } from "@/components/app/SupplierCategoryIcons";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSpotlightSupplierIds, searchSupplierAccounts } from "@/lib/data/store";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { SUBSCRIPTION_TIERS, formatCurrency } from "@/lib/config";
import { CheckCircle2, Crown, Flashlight, List, Map as MapIcon, MapPin, ShieldCheck, Sparkles, Star, X } from "lucide-react";

export const metadata = { title: "Leveranciers zoeken — Vyra" };

export default async function SupplierDirectoryPage(props: PageProps<"/leveranciers">) {
  const params = await props.searchParams;
  const category = typeof params.category === "string" && params.category ? (params.category as SupplierCategory) : undefined;
  const location = typeof params.location === "string" ? params.location.trim() : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const minPriceEuros = typeof params.minPrice === "string" && params.minPrice ? Number(params.minPrice) : undefined;
  const maxPriceEuros = typeof params.maxPrice === "string" && params.maxPrice ? Number(params.maxPrice) : undefined;
  const minPriceCents = minPriceEuros != null && Number.isFinite(minPriceEuros) ? Math.round(minPriceEuros * 100) : undefined;
  const maxPriceCents = maxPriceEuros != null && Number.isFinite(maxPriceEuros) ? Math.round(maxPriceEuros * 100) : undefined;
  const view: "lijst" | "kaart" = params.view === "kaart" ? "kaart" : "lijst";

  // De filters ZONDER categorie worden hieronder ook los gebruikt om het
  // aantal leveranciers per categorie te tellen (zie categoryItems) — dat
  // hergebruikt bewust dezelfde `searchSupplierAccounts`-functie i.p.v. een
  // nieuwe telquery te schrijven, zodat de tellingen gegarandeerd exact
  // dezelfde locatie/prijs/zoekterm-logica volgen als de resultaten zelf.
  const baseFilters = { location: location || undefined, query: q || undefined, minPriceCents, maxPriceCents };
  const [unsortedSuppliers, allForCategoryCounts] = await Promise.all([
    searchSupplierAccounts({ ...baseFilters, category }),
    category ? searchSupplierAccounts(baseFilters) : Promise.resolve(null),
  ]);
  const countsSource = allForCategoryCounts ?? unsortedSuppliers;
  const categoryCounts: Partial<Record<SupplierCategory, number>> = {};
  for (const s of countsSource) {
    for (const c of s.categories) categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
  }

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

  // Eén algemene hreflink-bouwer i.p.v. de losse buildCategoryHref/
  // buildViewHref van vroeger — elke aanroeper geeft alleen de velden mee
  // die moeten VERANDEREN, de rest blijft staan zoals het nu is. Een lege
  // string wist een veld.
  function buildHref(overrides: Partial<{ category: string; location: string; q: string; minPrice: string; maxPrice: string; view: string }>) {
    const next = {
      category: category ?? "",
      location,
      q,
      minPrice: minPriceEuros != null && Number.isFinite(minPriceEuros) ? String(minPriceEuros) : "",
      maxPrice: maxPriceEuros != null && Number.isFinite(maxPriceEuros) ? String(maxPriceEuros) : "",
      view: view === "kaart" ? "kaart" : "",
      ...overrides,
    };
    const qs = new URLSearchParams();
    if (next.category) qs.set("category", next.category);
    if (next.location) qs.set("location", next.location);
    if (next.q) qs.set("q", next.q);
    if (next.minPrice) qs.set("minPrice", next.minPrice);
    if (next.maxPrice) qs.set("maxPrice", next.maxPrice);
    if (next.view === "kaart") qs.set("view", "kaart");
    const query = qs.toString();
    return `/leveranciers${query ? `?${query}` : ""}`;
  }

  const categoryItems: SupplierCategoryFilterItem[] = (Object.entries(SUPPLIER_CATEGORY_LABELS) as [SupplierCategory, string][]).map(([key, label]) => {
    const Icon = SUPPLIER_CATEGORY_ICONS[key];
    return {
      key,
      label,
      icon: <Icon className="size-4" />,
      count: categoryCounts[key] ?? 0,
      href: buildHref({ category: key }),
      active: category === key,
    };
  });
  const allItem = { label: "Alle categorieën", count: countsSource.length, href: buildHref({ category: "" }), active: !category };

  const chips: { label: string; href: string }[] = [];
  if (category) chips.push({ label: SUPPLIER_CATEGORY_LABELS[category], href: buildHref({ category: "" }) });
  if (location) chips.push({ label: location, href: buildHref({ location: "" }) });
  if (q) chips.push({ label: `"${q}"`, href: buildHref({ q: "" }) });
  if (minPriceEuros != null || maxPriceEuros != null) {
    const label = minPriceEuros != null && maxPriceEuros != null ? `€${minPriceEuros} – €${maxPriceEuros}` : minPriceEuros != null ? `vanaf €${minPriceEuros}` : `tot €${maxPriceEuros}`;
    chips.push({ label, href: buildHref({ minPrice: "", maxPrice: "" }) });
  }

  // Dwingt MobileFilterDrawer (via zijn `key`) tot een verse mount zodra er
  // ook maar iets aan de actieve filters verandert — dan valt de drawer's
  // eigen open/dicht-status terug naar dicht. Zelfde `key`-herstart-truc als
  // BudgetAllocator.tsx elders in de app.
  const filterStateKey = `${category ?? ""}|${location}|${q}|${minPriceEuros ?? ""}|${maxPriceEuros ?? ""}|${view}`;

  const suppliersWithCoords = suppliers.filter((s) => s.lat != null && s.lng != null);
  const suppliersWithoutCoords = suppliers.length - suppliersWithCoords.length;

  const resultLabel = `${suppliers.length === 0 ? "Geen leveranciers gevonden" : `${suppliers.length} leverancier${suppliers.length !== 1 ? "s" : ""} gevonden`}${location ? ` in de buurt van "${location}"` : ""}`;

  const filterPanelCommon = {
    q,
    location,
    minPriceEuros,
    maxPriceEuros,
    category,
    view,
    hasFilters,
    clearHref: "/leveranciers",
    categoryItems,
    allItem,
    showSaveSearch: Boolean(user),
  };

  const main = (
    // `min-w-0`: <body> is elders (app/layout.tsx-achtige wrapper) `flex
    // flex-col`, waardoor <main> zelf een flex-item is. Zonder min-w-0 neemt
    // een flex-item bij overflow:visible de min-content-breedte van ZIJN
    // VOLLEDIGE inhoud over als eigen minimumbreedte — ook inhoud die dieper
    // genest al netjes in een eigen overflow-x-auto zit (de categorie-
    // iconenbalk hieronder, 22 niet-omslaande items). Dat "0-als-minimum"-
    // vangnet uit de flexbox-spec geldt namelijk alleen voor het element dat
    // ZELF een flex/grid-item is, niet voor een overflow:auto-nakomeling
    // verderop in de boom. Resultaat zonder deze regel: <main> (en dus de
    // hele pagina-breedte) rekte op tot max-w-6xl (1152px), ook op een
    // telefoon van 375px — precies het type horizontale-overflow-bug dat de
    // mobiele-navigatie-update eerder al elders in de app oploste.
    <main className="mx-auto w-full min-w-0 max-w-6xl px-6 py-10">
      {/* Terugknop (gemeld aug. 2026 — "ik mis ook het kruimelspoor en dat je
          terug kunt naar de pagina waar je was"): /leveranciers is vanaf veel
          verschillende plekken bereikbaar (homepage, dashboard, een
          leveranciersprofiel, de hoofdnavigatie), dus een vaste
          "kruimelpad"-tekst zou hier vaak niet kloppen. BackLink lost dat op
          zonder dat op te hoeven raden: hij gaat gewoon terug in de
          browserhistorie (dus naar waar je écht vandaan kwam), en valt alleen
          terug op een vaste bestemming als er geen historie is (bv. een
          rechtstreeks geopende link) — zie components/ui/BackLink.tsx. */}
      <BackLink fallbackHref={user ? "/events" : "/"} label="Terug" className="mb-3" />
      <h1 className="font-display text-3xl text-ink">Leveranciers zoeken</h1>
      <p className="mt-1 text-ink-soft">Filter op categorie, prijs en werkgebied — of beschrijf gewoon wat je zoekt.</p>

      <div className="mt-6 lg:hidden">
        <CategoryIconBar activeCategory={category} buildHref={(cat) => buildHref({ category: cat ?? "" })} />
      </div>

      {searchSaved && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Bewaard — je krijgt een melding zodra een nieuwe leverancier hierbij past. Bekijk al je bewaarde zoekopdrachten op{" "}
            <Link href="/mijn-leveranciers" className="underline">Mijn leveranciers</Link>.
          </span>
        </div>
      )}

      <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[260px_1fr] lg:items-start lg:gap-8">
        <aside className="hidden lg:sticky lg:top-6 lg:block">
          <Card className="p-5">
            <SupplierFilterPanel formId="filters-desktop" {...filterPanelCommon} />
          </Card>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden" key={filterStateKey}>
                <MobileFilterDrawer formId="filters-mobile" activeCount={chips.length} resultCount={suppliers.length} hasFilters={hasFilters} clearHref="/leveranciers">
                  <SupplierFilterPanel formId="filters-mobile" {...filterPanelCommon} showHeading={false} />
                </MobileFilterDrawer>
              </div>
              <p className="min-w-0 truncate text-sm text-ink-faint">{resultLabel}.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white p-1">
              <Link
                href={buildHref({ view: "" })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "lijst" ? "bg-clay text-white" : "text-ink-soft hover:bg-paper-dim"}`}
              >
                <List className="size-3.5" /> Lijst
              </Link>
              <Link
                href={buildHref({ view: "kaart" })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "kaart" ? "bg-clay text-white" : "text-ink-soft hover:bg-paper-dim"}`}
              >
                <MapIcon className="size-3.5" /> Kaart
              </Link>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="chip-hover inline-flex items-center gap-1 rounded-full bg-clay-50 py-1 pr-2 pl-2.5 text-xs font-medium text-clay-dark"
                >
                  {chip.label}
                  <X className="size-3" />
                </Link>
              ))}
            </div>
          )}

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
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {suppliers.map((s) => {
                // Was voorheen tot 4 badges naast elkaar (uitgelicht + elite +
                // aanbevolen + tot 3 categorieën) — gemeld als "druk" (aug.
                // 2026). Nu maximaal één statusbadge (op volgorde van
                // belang) plus de hoofdcategorie.
                const statusBadge = spotlightedIds.has(s.id) ? (
                  <Badge tone="ochre" icon={<Flashlight className="size-3" />}>Uitgelicht</Badge>
                ) : SUBSCRIPTION_TIERS[s.subscriptionTier].badge === "elite" ? (
                  <Badge tone="clay" icon={<Crown className="size-3" />}>Elite Partner</Badge>
                ) : SUBSCRIPTION_TIERS[s.subscriptionTier].badge === "aanbevolen" ? (
                  <Badge tone="ochre" icon={<Sparkles className="size-3" />}>Aanbevolen</Badge>
                ) : null;

                return (
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
                      {statusBadge}
                      <Badge tone="sage">{SUPPLIER_CATEGORY_LABELS[s.category]}</Badge>
                    </div>

                    <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{s.description}</p>

                    <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-sm">
                      <span className="flex items-center gap-1 text-ink-faint"><MapPin className="size-3.5" /> {s.baseLocation || "Onbekend"}</span>
                      <span className="font-medium text-ink">vanaf {formatCurrency(s.minPriceCents)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );

  if (user) {
    return (
      <div className="min-h-screen bg-paper">
        <AppTopBar />
        {/* md:pl-[var(--nav-sidebar-w)]: ruimte voor de permanente zijbalk, zie app/globals.css. */}
        <div className="transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">{main}</div>
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
