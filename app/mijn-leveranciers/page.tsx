import { redirect } from "next/navigation";
import Link from "next/link";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { FavoriteSupplierButton } from "@/components/app/FavoriteSupplierButton";
import { getCurrentUser } from "@/lib/auth";
import { listFavoriteSuppliers } from "@/lib/data/store";
import { formatCurrency } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { SIDEBAR_OFFSET_CLASS } from "@/lib/nav-constants";
import { cn } from "@/lib/utils";
import { Heart, MapPin, ShieldCheck, Star } from "lucide-react";

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

  const favorites = await listFavoriteSuppliers(user.id);

  return (
    <div className={cn("min-h-screen bg-paper", SIDEBAR_OFFSET_CLASS)}>
      <AppTopBar />
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-3xl text-ink">Mijn leveranciers</h1>
        <p className="mt-1 text-ink-soft">Leveranciers die je hebt opgeslagen — met één klik terug naar hun profiel om opnieuw een aanvraag te sturen.</p>

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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  );
}
