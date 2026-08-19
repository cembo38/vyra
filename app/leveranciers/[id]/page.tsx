import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccount, hasOrganizerContactedSupplier, isSupplierFavorited, listEventsForUser } from "@/lib/data/store";
import { submitCustomSupplierRequestAction } from "@/lib/actions/supplier-actions";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { FavoriteSupplierButton } from "@/components/app/FavoriteSupplierButton";
import { formatCurrency } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { SIDEBAR_OFFSET_CLASS } from "@/lib/nav-constants";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, ExternalLink, Link2, Lock, MapPin, MoonStar, ShieldCheck, Star } from "lucide-react";

export const metadata = { title: "Leveranciersprofiel — Vyra" };

export default async function PublicSupplierProfilePage(props: PageProps<"/leveranciers/[id]">) {
  const { id } = await props.params;
  const params = await props.searchParams;
  const requestSent = params.requestSent === "1";
  const hasError = params.error === "1";
  const closedError = params.closedError === "1";

  const supplier = await getSupplierAccount(id);
  if (!supplier) notFound();

  const user = await getCurrentUser();
  let events: Awaited<ReturnType<typeof listEventsForUser>> = [];
  let favorited = false;
  let alreadyContacted = false;
  if (user) {
    [events, favorited, alreadyContacted] = await Promise.all([
      listEventsForUser(user.id),
      isSupplierFavorited(supplier.id),
      hasOrganizerContactedSupplier(supplier.id),
    ]);
  }

  const categories = supplier.categories.length > 0 ? supplier.categories : [supplier.category];

  const main = (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <SupplierAvatar
            gradient={["#E8C9A8", "#B5674A"]}
            initials={supplier.companyName.slice(0, 2).toUpperCase()}
            imageUrl={supplier.logoUrl}
            verified={supplier.verified}
            size={72}
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl text-ink">{supplier.companyName}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {categories.map((c) => (
                <Badge key={c} tone="sage">{SUPPLIER_CATEGORY_LABELS[c]}</Badge>
              ))}
              {supplier.categoryOther && <Badge tone="neutral">{supplier.categoryOther}</Badge>}
              {supplier.verified && (
                <Badge tone="success" icon={<ShieldCheck className="size-3" />}>Geverifieerd</Badge>
              )}
              {!supplier.storeOpen && (
                <Badge tone="neutral" icon={<MoonStar className="size-3" />}>Tijdelijk gesloten</Badge>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-soft">
              {supplier.ratingCount > 0 ? (
                <span className="flex items-center gap-1"><Star className="size-3.5 fill-ochre text-ochre" /> {supplier.ratingAvg.toFixed(1)} ({supplier.ratingCount} review{supplier.ratingCount !== 1 ? "s" : ""})</span>
              ) : (
                <span className="flex items-center gap-1 text-ink-faint"><Star className="size-3.5" /> Nog geen reviews</span>
              )}
              <span className="flex items-center gap-1"><Clock className="size-3.5" /> Reageert meestal binnen {supplier.avgResponseHours} uur</span>
              <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {supplier.baseLocation} · straal {supplier.serviceRadiusKm} km</span>
            </div>

            {(supplier.website || supplier.socialFacebook || supplier.socialInstagram || supplier.socialTiktok) && (
              alreadyContacted ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  {supplier.website && (
                    <a href={supplier.website} target="_blank" className="flex items-center gap-1 text-sage hover:underline">
                      <ExternalLink className="size-3.5" /> Website
                    </a>
                  )}
                  {supplier.socialFacebook && (
                    <a href={supplier.socialFacebook} target="_blank" className="flex items-center gap-1 text-sage hover:underline">
                      <Link2 className="size-3.5" /> Facebook
                    </a>
                  )}
                  {supplier.socialInstagram && (
                    <a href={supplier.socialInstagram} target="_blank" className="flex items-center gap-1 text-sage hover:underline">
                      <Link2 className="size-3.5" /> Instagram
                    </a>
                  )}
                  {supplier.socialTiktok && (
                    <a href={supplier.socialTiktok} target="_blank" className="flex items-center gap-1 text-sage hover:underline">
                      <Link2 className="size-3.5" /> TikTok
                    </a>
                  )}
                  {supplier.kvkNumber && <span className="text-ink-faint">KVK {supplier.kvkNumber}</span>}
                </div>
              ) : (
                // Website/social media pas tonen ná het eerste contact via Vyra
                // (spec-item #54) — voorkomt dat elke bezoeker deze leverancier
                // meteen buiten het platform om kan benaderen, nog vóórdat Vyra
                // iets heeft kunnen bijdragen aan de match.
                <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-faint">
                  <Lock className="size-3.5" /> Website &amp; social media zichtbaar na je eerste bericht aan {supplier.companyName}
                </p>
              )
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {user && <FavoriteSupplierButton supplierId={supplier.id} initialFavorited={favorited} />}
            <div className="text-right">
              <p className="text-xs text-ink-faint">Vanaf</p>
              <p className="font-display text-xl text-ink">{formatCurrency(supplier.minPriceCents)}</p>
            </div>
          </div>
        </div>

        <p className="mt-5 border-t border-line-soft pt-5 text-sm leading-relaxed text-ink-soft">{supplier.description}</p>

        {supplier.galleryUrls.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {supplier.galleryUrls.map((url) => (
              <div key={url} className="img-zoom-wrap aspect-square rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={supplier.companyName} className="img-zoom h-full w-full rounded-xl object-cover" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-display text-lg text-ink">Vraag maatwerk aan</h2>
        <p className="mt-1 text-sm text-ink-faint">Stuur deze leverancier rechtstreeks een aanvraag voor een van je evenementen — geen automatische matching, direct naar {supplier.companyName}.</p>

        {requestSent && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> Je maatwerkaanvraag is verstuurd naar {supplier.companyName}.
          </div>
        )}
        {hasError && (
          <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Vul een evenement en een omschrijving in voordat je verstuurt.
          </div>
        )}
        {closedError && (
          <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Deze leverancier staat momenteel op gesloten en kan geen nieuwe aanvragen aannemen.
          </div>
        )}

        {!supplier.storeOpen ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-line-soft bg-paper-dim px-4 py-3 text-sm text-ink-soft">
            <MoonStar className="size-4.5 shrink-0 text-ink-faint" />
            {supplier.companyName} staat momenteel op gesloten en neemt geen nieuwe aanvragen aan. Kijk later nog eens terug, of{" "}
            {favorited ? "je vindt ze terug via " : "sla ze op als favoriet via "}
            {favorited ? <Link href="/mijn-leveranciers" className="font-medium text-clay hover:underline">Mijn leveranciers</Link> : "het hartje hierboven"}.
          </div>
        ) : !user ? (
          <p className="mt-4 text-sm text-ink-soft">
            <Link href={`/login?redirect=/leveranciers/${supplier.id}`} className="font-medium text-clay hover:underline">Log in</Link> of{" "}
            <Link href={`/signup?intent=organizer`} className="font-medium text-clay hover:underline">maak een account</Link> om een maatwerkaanvraag te sturen.
          </p>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">
            Je hebt nog geen evenement om deze aanvraag aan te koppelen.{" "}
            <Link href="/events/new" className="font-medium text-clay hover:underline">Maak eerst een evenement aan</Link>.
          </p>
        ) : (
          <form action={submitCustomSupplierRequestAction} className="mt-4 space-y-4">
            <input type="hidden" name="supplierId" value={supplier.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Evenement" required>
                <Select name="eventId" required defaultValue={events[0].id}>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Categorie" required>
                <Select name="categoryKey" required defaultValue={categories[0]}>
                  {categories.map((c) => (
                    <option key={c} value={c}>{SUPPLIER_CATEGORY_LABELS[c]}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Wat heb je nodig?" required hint="Beschrijf zo concreet mogelijk wat je zoekt">
              <Textarea name="desiredService" required rows={3} placeholder="Bijv. 'Live band voor 3 uur, jazz/soul, vanaf 20:00 uur.'" />
            </Field>
            <Field label="Bijzondere wensen" hint="Optioneel">
              <Textarea name="specialRequests" rows={2} />
            </Field>
            <Field label="Budget-indicatie (€)" hint="Optioneel">
              <Input name="budget" type="number" min={0} step={1} />
            </Field>
            <button type="submit" className="lift-hover w-full rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark">
              Maatwerkaanvraag versturen
            </button>
          </form>
        )}
      </Card>
    </div>
  );

  if (user) {
    return (
      <div className={cn("min-h-screen bg-paper", SIDEBAR_OFFSET_CLASS)}>
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
