import { redirect } from "next/navigation";
import Link from "next/link";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { FavoriteSupplierButton } from "@/components/app/FavoriteSupplierButton";
import { getCurrentUser } from "@/lib/auth";
import { getSavedSearchesForUser, listFavoriteSuppliers } from "@/lib/data/store";
import { deleteSavedSearchAction } from "@/lib/actions/misc-actions";
import { formatCurrency } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS, SavedSearch } from "@/lib/types";
import { BookmarkX, Heart, MapPin, Search, ShieldCheck, Star } from "lucide-react";

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
 * Overzicht van opgeslagen favoriete leveranciers (spec-item #54:
 * organisatoren laten terugkeren). Elke kaart linkt naar het bestaande
 * leveranciersprofiel — dat heeft al een "Vraag maatwerk aan"-formulier,
 * dus "opnieuw boeken" hergebruikt bewust die bestaande flow i.p.v. een
 * nieuwe te bouwen.
 */
export default async function MyFavoriteSuppliersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/mijn-leveranciers");

  const [favorites, savedSearches] = await Promise.all([listFavoriteSuppliers(user.id), getSavedSearchesForUser(user.id)]);

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
                    <button type="submit" aria-label="Bewaarde zoekopdracht verwijderen" className="chip-hover flex items-center gap-1 text-xs font-medium text-ink-faint hover:text-danger">
                      <BookmarkX className="size-3.5" /> Verwijderen
                    </button>
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
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map(({ supplier }) => (
              <div key={supplier.id} className="card-hover relative rounded-2xl border border-line bg-white p-5 hover:border-clay/50 [box-shadow:var(--shadow-card)]">
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
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
