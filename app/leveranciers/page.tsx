import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { AppTopBar } from "@/components/app/AppTopBar";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { CategoryIconBar, buildCategoryIconBarItems } from "@/components/app/CategoryIconBar";
import { CompareCheckbox } from "@/components/app/CompareCheckbox";
import { CompareToolbar } from "@/components/app/CompareToolbar";
import { SupplierMap } from "@/components/ui/SupplierMap";
import { SupplierFilterPanel } from "@/components/app/SupplierFilterPanel";
import { MobileFilterDrawer } from "@/components/app/MobileFilterDrawer";
import { SortSelect } from "@/components/app/SortSelect";
import { SupplierCategoryFilterItem } from "@/components/app/SupplierCategoryFilterList";
import { SUPPLIER_CATEGORY_ICONS } from "@/components/app/SupplierCategoryIcons";
import { getCurrentUser } from "@/lib/auth";
import { getActiveSpotlightSupplierIds, searchSupplierAccounts } from "@/lib/data/store";
import { SUPPLIER_CATEGORY_LABELS, SupplierCategory } from "@/lib/types";
import { isTrustedSupplier, TRUST_BADGE_EXPLANATION } from "@/lib/trust";
import { SUBSCRIPTION_TIERS, formatCurrency } from "@/lib/config";
import { CheckCircle2, Crown, Flashlight, List, Map as MapIcon, MapPin, ShieldCheck, Sparkles, Star, X } from "lucide-react";

export const metadata = { title: "Leveranciers zoeken — Vyra" };

const CATEGORY_KEYS = new Set(Object.keys(SUPPLIER_CATEGORY_LABELS));

// Sorteeropties (spec: "sorteren op prijs/score/reactietijd", vergelijkbaar
// met Etsy's "Prijs: laag naar hoog" e.d.). "aanbevolen" is bewust géén
// echte sorteersleutel op een veld — dat is de bestaande uitgelicht-eerst-
// volgorde die hieronder al werd toegepast, nu als expliciete keuze in het
// dropdown i.p.v. de enige, impliciete volgorde.
const SORT_OPTIONS = [
  { key: "aanbevolen", label: "Aanbevolen" },
  { key: "prijs-asc", label: "Prijs: laag naar hoog" },
  { key: "prijs-desc", label: "Prijs: hoog naar laag" },
  { key: "score", label: "Hoogst beoordeeld" },
  { key: "reactietijd", label: "Snelste reactietijd" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];
const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((o) => o.key));

/** `?categories=photography,catering` — komma-gescheiden i.p.v. herhaalde queryparams: makkelijker als verborgen formuliervel en als leesbare URL om te delen/bewaren. Onbekende waardes (getypte URL, verwijderde categorie) worden stilzwijgend genegeerd. */
function parseCategories(raw: unknown): SupplierCategory[] {
  if (typeof raw !== "string" || !raw) return [];
  const seen = new Set<string>();
  const out: SupplierCategory[] = [];
  for (const key of raw.split(",")) {
    if (CATEGORY_KEYS.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(key as SupplierCategory);
    }
  }
  return out;
}

export default async function SupplierDirectoryPage(props: PageProps<"/leveranciers">) {
  const params = await props.searchParams;
  const categories = parseCategories(params.categories);
  const location = typeof params.location === "string" ? params.location.trim() : "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const minPriceEuros = typeof params.minPrice === "string" && params.minPrice ? Number(params.minPrice) : undefined;
  const maxPriceEuros = typeof params.maxPrice === "string" && params.maxPrice ? Number(params.maxPrice) : undefined;
  const minPriceCents = minPriceEuros != null && Number.isFinite(minPriceEuros) ? Math.round(minPriceEuros * 100) : undefined;
  const maxPriceCents = maxPriceEuros != null && Number.isFinite(maxPriceEuros) ? Math.round(maxPriceEuros * 100) : undefined;
  const view: "lijst" | "kaart" = params.view === "kaart" ? "kaart" : "lijst";
  const sort: SortKey = typeof params.sort === "string" && SORT_KEYS.has(params.sort) ? (params.sort as SortKey) : "aanbevolen";
  const verifiedOnly = params.verified === "1";
  const minRatingRaw = typeof params.minScore === "string" && params.minScore ? Number(params.minScore) : undefined;
  const minRating = minRatingRaw != null && Number.isFinite(minRatingRaw) && minRatingRaw >= 1 && minRatingRaw <= 5 ? minRatingRaw : undefined;

  // De filters ZONDER categorie worden hieronder ook los gebruikt om het
  // aantal leveranciers per categorie te tellen (zie categoryItems) — dat
  // hergebruikt bewust dezelfde `searchSupplierAccounts`-functie i.p.v. een
  // nieuwe telquery te schrijven, zodat de tellingen gegarandeerd exact
  // dezelfde locatie/prijs/zoekterm-logica volgen als de resultaten zelf.
  const baseFilters = { location: location || undefined, query: q || undefined, minPriceCents, maxPriceCents, verifiedOnly, minRating };
  const [unsortedSuppliers, allForCategoryCounts] = await Promise.all([
    searchSupplierAccounts({ ...baseFilters, categories }),
    categories.length > 0 ? searchSupplierAccounts(baseFilters) : Promise.resolve(null),
  ]);
  const countsSource = allForCategoryCounts ?? unsortedSuppliers;
  const categoryCounts: Partial<Record<SupplierCategory, number>> = {};
  for (const s of countsSource) {
    for (const c of s.categories) categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
  }

  // Spotlight (leverancier heeft zelf tijdelijk een categorie "uitgelicht",
  // zie SpotlightPanel.tsx): boven aan de resultaten + een badge. Bij een
  // categoriefilter telt alleen een spotlight VOOR één van de geselecteerde
  // categorieën mee — anders elke actieve spotlight van de leverancier.
  const spotlightedIds = await getActiveSpotlightSupplierIds(unsortedSuppliers.map((s) => s.id), categories.length > 0 ? categories : undefined);
  // Bij "aanbevolen" (default) blijft de bestaande uitgelicht-eerst-volgorde
  // gelden. Bij een expliciete sorteerkeuze (prijs/score/reactietijd) wint
  // die keuze volledig — net als bij Etsy's "Sorteren op" negeert een
  // expliciete sortering de standaard aanbevolen-volgorde, anders zou
  // "Prijs: laag naar hoog" bijvoorbeeld toch nog uitgelichte leveranciers
  // vooraan tonen, ook als die duurder zijn.
  //
  // Leveranciers zonder reviews (ratingCount 0) horen bij "Hoogst
  // beoordeeld" niet mee te tellen als een 0-score — dat zou ze onterecht
  // onderaan een lijst met slecht-beoordeelde leveranciers zetten in plaats
  // van gewoon "nog onbeoordeeld" te zijn (zelfde patroon als de admin-
  // leverancierslijst, zie app/admin/(protected)/leveranciers/page.tsx).
  const suppliers = [...unsortedSuppliers].sort((a, b) => {
    switch (sort) {
      case "prijs-asc":
        return a.minPriceCents - b.minPriceCents;
      case "prijs-desc":
        return b.minPriceCents - a.minPriceCents;
      case "score":
        if (a.ratingCount === 0 && b.ratingCount === 0) return 0;
        if (a.ratingCount === 0) return 1;
        if (b.ratingCount === 0) return -1;
        return b.ratingAvg - a.ratingAvg;
      case "reactietijd":
        return a.avgResponseHours - b.avgResponseHours;
      default: {
        const aSpot = spotlightedIds.has(a.id) ? 1 : 0;
        const bSpot = spotlightedIds.has(b.id) ? 1 : 0;
        return bSpot - aSpot;
      }
    }
  });

  const hasFilters = Boolean(categories.length > 0 || location || q || minPriceEuros || maxPriceEuros || verifiedOnly || minRating);
  const searchSaved = params.searchSaved === "1";
  const user = await getCurrentUser();

  // Eén algemene hreflink-bouwer i.p.v. de losse buildCategoryHref/
  // buildViewHref van vroeger — elke aanroeper geeft alleen de velden mee
  // die moeten VERANDEREN, de rest blijft staan zoals het nu is. Een lege
  // string wist een veld. `categories` is hier al een komma-gescheiden
  // string (de aanroeper bouwt die), net als de andere velden.
  function buildHref(
    overrides: Partial<{ categories: string; location: string; q: string; minPrice: string; maxPrice: string; view: string; sort: string; verified: string; minScore: string }>
  ) {
    const next = {
      categories: categories.join(","),
      location,
      q,
      minPrice: minPriceEuros != null && Number.isFinite(minPriceEuros) ? String(minPriceEuros) : "",
      maxPrice: maxPriceEuros != null && Number.isFinite(maxPriceEuros) ? String(maxPriceEuros) : "",
      view: view === "kaart" ? "kaart" : "",
      sort: sort !== "aanbevolen" ? sort : "",
      verified: verifiedOnly ? "1" : "",
      minScore: minRating != null ? String(minRating) : "",
      ...overrides,
    };
    const qs = new URLSearchParams();
    if (next.categories) qs.set("categories", next.categories);
    if (next.location) qs.set("location", next.location);
    if (next.q) qs.set("q", next.q);
    if (next.minPrice) qs.set("minPrice", next.minPrice);
    if (next.maxPrice) qs.set("maxPrice", next.maxPrice);
    if (next.view === "kaart") qs.set("view", "kaart");
    if (next.sort && next.sort !== "aanbevolen") qs.set("sort", next.sort);
    if (next.verified === "1") qs.set("verified", "1");
    if (next.minScore) qs.set("minScore", next.minScore);
    const query = qs.toString();
    return `/leveranciers${query ? `?${query}` : ""}`;
  }

  function toggleCategoryHref(key: SupplierCategory) {
    const next = categories.includes(key) ? categories.filter((c) => c !== key) : [...categories, key];
    return buildHref({ categories: next.join(",") });
  }

  const categoryItems: SupplierCategoryFilterItem[] = (Object.entries(SUPPLIER_CATEGORY_LABELS) as [SupplierCategory, string][]).map(([key, label]) => {
    const Icon = SUPPLIER_CATEGORY_ICONS[key];
    return {
      key,
      label,
      icon: <Icon className="size-4" />,
      count: categoryCounts[key] ?? 0,
      href: toggleCategoryHref(key),
      active: categories.includes(key),
    };
  });
  const allItem = { label: "Alle categorieën", count: countsSource.length, href: buildHref({ categories: "" }), active: categories.length === 0 };
  const iconBarItems = buildCategoryIconBarItems(categories, (cats) => buildHref({ categories: cats.join(",") }));

  const chips: { label: string; href: string }[] = [];
  for (const c of categories) chips.push({ label: SUPPLIER_CATEGORY_LABELS[c], href: toggleCategoryHref(c) });
  if (location) chips.push({ label: location, href: buildHref({ location: "" }) });
  if (q) chips.push({ label: `"${q}"`, href: buildHref({ q: "" }) });
  if (minPriceEuros != null || maxPriceEuros != null) {
    const label = minPriceEuros != null && maxPriceEuros != null ? `€${minPriceEuros} – €${maxPriceEuros}` : minPriceEuros != null ? `vanaf €${minPriceEuros}` : `tot €${maxPriceEuros}`;
    chips.push({ label, href: buildHref({ minPrice: "", maxPrice: "" }) });
  }
  if (verifiedOnly) chips.push({ label: "Alleen geverifieerd", href: buildHref({ verified: "" }) });
  if (minRating != null) chips.push({ label: `Vanaf ${minRating}★`, href: buildHref({ minScore: "" }) });

  // Dwingt MobileFilterDrawer (via zijn `key`) tot een verse mount zodra er
  // ook maar iets aan de actieve filters verandert — dan valt de drawer's
  // eigen open/dicht-status terug naar dicht. Zelfde `key`-herstart-truc als
  // BudgetAllocator.tsx elders in de app.
  const filterStateKey = `${categories.join(",")}|${location}|${q}|${minPriceEuros ?? ""}|${maxPriceEuros ?? ""}|${view}|${verifiedOnly}|${minRating ?? ""}`;

  const sortHrefs = Object.fromEntries(SORT_OPTIONS.map((o) => [o.key, buildHref({ sort: o.key === "aanbevolen" ? "" : o.key })])) as Record<SortKey, string>;

  const suppliersWithCoords = suppliers.filter((s) => s.lat != null && s.lng != null);
  const suppliersWithoutCoords = suppliers.length - suppliersWithCoords.length;

  const resultLabel = `${suppliers.length === 0 ? "Geen leveranciers gevonden" : `${suppliers.length} leverancier${suppliers.length !== 1 ? "s" : ""} gevonden`}${location ? ` in de buurt van "${location}"` : ""}`;

  const filterPanelCommon = {
    q,
    location,
    minPriceEuros,
    maxPriceEuros,
    categories,
    view,
    sort,
    verifiedOnly,
    minRating,
    hasFilters,
    clearHref: "/leveranciers",
    categoryItems,
    allItem,
    // Een bewaarde zoekopdracht heeft in de database precies één (optionele)
    // categorie (spec, zie SavedSearch/saveSearchAction) — bij meerdere
    // aangevinkte categorieën is dat niet eenduidig op te slaan, dus tonen
    // we "Bewaar" dan liever niet dan een verkeerde selectie te bewaren.
    showSaveSearch: Boolean(user) && categories.length <= 1,
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
    <main className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
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
      <h1 className="font-display text-2xl text-ink sm:text-3xl">Leveranciers zoeken</h1>
      <p className="mt-1 text-sm text-ink-soft sm:text-base">Tik één of meerdere categorieën aan, of beschrijf gewoon wat je zoekt.</p>

      {/* Cem (aug. 2026): "ik mis de eerder genoemde balk/carrousel... zorg
          ook dat alles op mobiel goed werkt, mobiel is het belangrijkste" —
          voorheen alleen `lg:hidden` (dus verborgen op precies het formaat
          van zijn screenshot). Nu op elk schermformaat zichtbaar: op mobiel
          is dit de PRIMAIRE manier om te filteren, op desktop een snelle
          aanvulling naast de doorzoekbare lijst in de zijbalk. */}
      <div className="mt-5">
        <CategoryIconBar items={iconBarItems} allActive={categories.length === 0} allHref={buildHref({ categories: "" })} />
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
            <div className="flex shrink-0 items-center gap-2">
              <SortSelect value={sort} options={SORT_OPTIONS} hrefs={sortHrefs} />
              <div className="flex items-center gap-1 rounded-xl border border-line bg-white p-1">
                <Link
                  href={buildHref({ view: "" })}
                  className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "lijst" ? "bg-clay text-white" : "text-ink-soft hover:bg-paper-dim"}`}
                >
                  <List className="size-3.5" /> Lijst
                </Link>
                <Link
                  href={buildHref({ view: "kaart" })}
                  className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === "kaart" ? "bg-clay text-white" : "text-ink-soft hover:bg-paper-dim"}`}
                >
                  <MapIcon className="size-3.5" /> Kaart
                </Link>
              </div>
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
            <CompareToolbar>
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
                  <div
                    key={s.id}
                    className="card-hover relative rounded-2xl border border-line bg-white hover:border-clay/50 [box-shadow:var(--shadow-card)]"
                  >
                    <CompareCheckbox id={s.id} companyName={s.companyName} className="absolute right-3 top-3 z-10 bg-white" />
                    <Link href={`/leveranciers/${s.id}`} className="block p-5">
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
                          {isTrustedSupplier(s) ? (
                            <span title={TRUST_BADGE_EXPLANATION} className="ml-1 flex items-center gap-0.5 font-medium text-sage-dark">
                              <ShieldCheck className="size-3" /> Vertrouwd
                            </span>
                          ) : (
                            s.verified && <ShieldCheck className="ml-1 size-3 text-sage" />
                          )}
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
                  </div>
                );
              })}
            </div>
            </CompareToolbar>
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
