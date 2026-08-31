import { redirect } from "next/navigation";
import Link from "next/link";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { FavoriteSupplierButton } from "@/components/app/FavoriteSupplierButton";
import { CreateFavoriteCollectionForm } from "@/components/app/CreateFavoriteCollectionForm";
import { FavoriteCollectionHeader } from "@/components/app/FavoriteCollectionHeader";
import { FavoriteCollectionSelect } from "@/components/app/FavoriteCollectionSelect";
import { getCurrentUser } from "@/lib/auth";
import { getFavoriteSupplierEngagements, getSavedSearchesForUser, listFavoriteCollections, listFavoriteSuppliers } from "@/lib/data/store";
import { deleteSavedSearchAction } from "@/lib/actions/misc-actions";
import { formatCurrency } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS, SavedSearch, SupplierAccount, SupplierFavorite } from "@/lib/types";
import { BookmarkX, FolderHeart, Heart, MapPin, MessageSquareText, Search, ShieldCheck, Star } from "lucide-react";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** "Cateraars in Utrecht" / "Alle leveranciers" — leesbare samenvatting van een bewaarde zoekopdracht. */
function describeSearch(s: SavedSearch): string {
  const parts: string[] = [];
  parts.push(s.categoryKey ? SUPPLIER_CATEGORY_LABELS[s.categoryKey] : "Alle categorieën");
  if (s.location) parts.push(`in ${s.location}`);
  if (s.query) parts.push(`— "${s.query}"`);
  return parts.join(" ");
}

function searchHref(s: SavedSearch): string {
  const qs = new URLSearchParams();
  // /leveranciers verwacht sinds de multi-select categoriebalk (aug. 2026)
  // een komma-gescheiden `categories`-param i.p.v. het vroegere `category`
  // — een bewaarde zoekopdracht heeft er zelf altijd maar één (zie de
  // toelichting bij saveSearchAction), dus is dat hier gewoon één waarde.
  if (s.categoryKey) qs.set("categories", s.categoryKey);
  if (s.location) qs.set("location", s.location);
  if (s.query) qs.set("q", s.query);
  const query = qs.toString();
  return `/leveranciers${query ? `?${query}` : ""}`;
}

export const metadata = { title: "Mijn leveranciers — Vyra" };

/**
 * Eén favoriet-kaart — los getrokken uit de pagina zelf zodat 'm zowel in de
 * platte grid (geen collecties) als in elke collectie-groep hergebruikt kan
 * worden zonder de opmaak te dupliceren. `FavoriteCollectionSelect` staat
 * BUITEN de `<Link>` (net als `FavoriteSupplierButton`) — een `<select>`
 * genest in een `<a>` is ongeldige/onvoorspelbare HTML, zelfde reden als
 * elders in de app (zie CompareCheckbox.tsx).
 */
function FavoriteCard({
  supplier,
  favoriteCollectionId,
  collectionsList,
  activeEngagements,
}: {
  supplier: SupplierAccount;
  favoriteCollectionId: string | null;
  collectionsList: { id: string; name: string }[];
  activeEngagements: { eventId: string; eventName: string; categoryKey: string }[];
}) {
  return (
    <div className="card-hover relative rounded-2xl border border-line bg-white p-5 hover:border-clay/50 [box-shadow:var(--shadow-card)]">
      <div className="absolute right-4 top-4">
        <FavoriteSupplierButton supplierId={supplier.id} initialFavorited />
      </div>
      <Link href={`/leveranciers/${supplier.id}`} className="block pr-12">
        <div className="flex items-start gap-3">
          <SupplierAvatar
            gradient={["#E8C9A8", "#B5674A"]}
            initials={supplier.companyName.slice(0, 2).toUpperCase()}
            imageUrl={supplier.logoUrl}
            verified={supplier.verified}
            size={48}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">{supplier.companyName}</p>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
              {supplier.ratingCount > 0 ? (
                <>
                  <Star className="size-3 fill-ochre text-ochre" /> {supplier.ratingAvg.toFixed(1)} ({supplier.ratingCount})
                </>
              ) : (
                <span>Nog geen reviews</span>
              )}
              {supplier.verified && <ShieldCheck className="ml-1 size-3 text-sage" />}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(supplier.categories.length > 0 ? supplier.categories : [supplier.category]).slice(0, 3).map((c) => (
            <Badge key={c} tone="sage">{SUPPLIER_CATEGORY_LABELS[c]}</Badge>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-sm">
          <span className="flex items-center gap-1 text-ink-faint"><MapPin className="size-3.5" /> {supplier.baseLocation || "Onbekend"}</span>
          <span className="font-medium text-ink">vanaf {formatCurrency(supplier.minPriceCents)}</span>
        </div>
      </Link>
      {activeEngagements.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-line-soft pt-3">
          {activeEngagements.map((e) => (
            <Link
              key={`${e.eventId}-${e.categoryKey}`}
              href={`/events/${e.eventId}/shortlist`}
              className="chip-hover flex items-center gap-1.5 rounded-lg bg-sage-50 px-2.5 py-1.5 text-xs font-medium text-sage-dark hover:underline"
            >
              <MessageSquareText className="size-3.5 shrink-0" /> Actief bij {e.eventName} — bekijk shortlist
            </Link>
          ))}
        </div>
      )}
      {collectionsList.length > 0 && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <FavoriteCollectionSelect supplierId={supplier.id} currentCollectionId={favoriteCollectionId} collections={collectionsList} />
        </div>
      )}
    </div>
  );
}

/**
 * Overzicht van opgeslagen favoriete leveranciers (spec-item #54:
 * organisatoren laten terugkeren). Elke kaart linkt naar het bestaande
 * leveranciersprofiel — dat heeft al een "Vraag maatwerk aan"-formulier,
 * dus "opnieuw boeken" hergebruikt bewust die bestaande flow i.p.v. een
 * nieuwe te bouwen.
 */
export default async function MyFavoriteSuppliersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/mijn-leveranciers");

  const [favorites, savedSearches, collections] = await Promise.all([
    listFavoriteSuppliers(user.id),
    getSavedSearchesForUser(user.id),
    listFavoriteCollections(user.id),
  ]);
  // Kruislink met de per-evenement shortlist (livegang-audit) — een
  // favoriet die momenteel ook echt actief is (geaccepteerd/shortlisted)
  // voor een van je evenementen krijgt hieronder een directe link daar
  // naartoe, i.p.v. dat je los moet onthouden in welk evenement dat was.
  const engagements = await getFavoriteSupplierEngagements(user.id, favorites.map((f) => f.supplier.id));

  // Genoemde collecties (spec-item #129) — alleen groeperen zodra er
  // daadwerkelijk collecties bestaan; iemand die nog nooit heeft ingedeeld
  // krijgt gewoon de vertrouwde platte grid, geen kale "Niet ingedeeld"-kop
  // boven alles.
  const collectionsList = collections.map((c) => ({ id: c.id, name: c.name }));
  const groups: { id: string | null; name: string; favorites: { favorite: SupplierFavorite; supplier: SupplierAccount }[] }[] =
    collections.length > 0
      ? [
          ...collections.map((c) => ({ id: c.id, name: c.name, favorites: favorites.filter((f) => f.favorite.collectionId === c.id) })),
          { id: null, name: "Niet ingedeeld", favorites: favorites.filter((f) => f.favorite.collectionId === null) },
        ]
      : [];

  return (
    <div className="min-h-screen bg-paper">
      <AppTopBar />
      {/* md:pl-[var(--nav-sidebar-w)]: ruimte voor de permanente zijbalk, zie app/globals.css. */}
      <div className="transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-ink">Mijn leveranciers</h1>
        <p className="mt-1 text-ink-soft">Leveranciers die je hebt opgeslagen — met één klik terug naar hun profiel om opnieuw een aanvraag te sturen.</p>

        {savedSearches.length > 0 && (
          <Card className="mt-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">Bewaarde zoekopdrachten</h2>
            <p className="mt-1 text-sm text-ink-soft">Je krijgt een melding zodra een nieuwe leverancier bij een van deze zoekopdrachten past.</p>
            <div className="mt-3 space-y-2">
              {savedSearches.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line-soft px-3.5 py-2.5">
                  <Link href={searchHref(s)} className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink hover:text-sage">
                    <Search className="size-3.5 shrink-0 text-ink-faint" />
                    <span className="truncate">{describeSearch(s)}</span>
                  </Link>
                  <form action={deleteSavedSearchAction.bind(null, s.id)}>
                    <SubmitButton pendingLabel="Bezig met verwijderen…" className="chip-hover flex items-center gap-1 text-xs font-medium text-ink-faint hover:text-danger">
                      <BookmarkX className="size-3.5" /> Verwijderen
                    </SubmitButton>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        )}

        {favorites.length === 0 ? (
          <Card className="mt-6">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Heart className="size-8 text-ink-faint" />
              <p className="text-sm text-ink-soft">
                Nog geen favorieten. Sla een leverancier op via het hartje op hun profiel, dan vind je ze hier terug voor je volgende evenement.
              </p>
              <Link href="/leveranciers" className="mt-1 text-sm font-medium text-clay hover:underline">Leveranciers bekijken</Link>
            </div>
          </Card>
        ) : (
          <>
            <Card className="mt-6">
              <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-ink-faint">
                <FolderHeart className="size-3.5" /> Collecties
              </h2>
              <p className="mt-1 text-sm text-ink-soft">Deel je favorieten in per evenement of gelegenheid (bv. &quot;Bruiloft 2027&quot;) — puur voor jezelf, verandert niets aan de leverancier zelf.</p>
              <div className="mt-3">
                <CreateFavoriteCollectionForm />
              </div>
            </Card>

            {groups.length > 0 ? (
              <div className="mt-6 space-y-8">
                {groups.map((group) => (
                  <div key={group.id ?? "unsorted"}>
                    {group.id ? (
                      <FavoriteCollectionHeader collectionId={group.id} name={group.name} count={group.favorites.length} />
                    ) : (
                      <h2 className="flex items-center gap-1.5 font-display text-lg text-ink-faint">{group.name} <span className="text-xs">({group.favorites.length})</span></h2>
                    )}
                    {group.favorites.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-faint">Nog geen favorieten in deze collectie — verplaats er hieronder een naartoe via het keuzemenu op een kaart.</p>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {group.favorites.map(({ favorite, supplier }) => (
                          <FavoriteCard
                            key={supplier.id}
                            supplier={supplier}
                            favoriteCollectionId={favorite.collectionId}
                            collectionsList={collectionsList}
                            activeEngagements={engagements.get(supplier.id) ?? []}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {favorites.map(({ favorite, supplier }) => (
                  <FavoriteCard
                    key={supplier.id}
                    supplier={supplier}
                    favoriteCollectionId={favorite.collectionId}
                    collectionsList={collectionsList}
                    activeEngagements={engagements.get(supplier.id) ?? []}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
