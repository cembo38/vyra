import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/Collapsible";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { SubscriptionTierPicker } from "@/components/app/SubscriptionTierPicker";
import { SupplierDescriptionField } from "@/components/app/SupplierDescriptionField";
import { getCurrentUser } from "@/lib/auth";
import {
  getSupplierAccountByOwner,
  getSupplierCommissionStatus,
  getSupplierEffectiveTierDefinition,
} from "@/lib/data/store";
import {
  updateSupplierProfileAction,
  updateSupplierPackagesAction,
  removeSupplierGalleryImageAction,
  requestSupplierVerificationAction,
} from "@/lib/actions/supplier-actions";
import { SUPPLIER_CATEGORY_LABELS, SupplierPackageTier } from "@/lib/types";
import { BadgeCheck, CheckCircle2, Clock, ExternalLink, ImagePlus, Lock, Package, X } from "lucide-react";

const PACKAGE_TIER_LABELS: Record<SupplierPackageTier, string> = {
  basis: "Basis",
  standaard: "Standaard",
  premium: "Premium",
};

export const metadata = { title: "Bedrijfsprofiel — Vyra voor leveranciers" };

/**
 * Cem (aug. 2026): "het bedrijfsprofiel pagina is erg druk... laat alleen
 * het broodnodige op de pagina die ook echt toebehoren daar... Eventueel
 * met uitklaptoetsen (bijvoorbeeld de abonnementen). De rest dat eigenlijk
 * niet toebehoord op deze pagina, maak een gepaste pagina daarvoor aan."
 *
 * Drie ingrepen t.o.v. de vorige versie:
 * 1. Verificatie was een hele Card met uitleg-alinea — nu een badge in de
 *    kop, met alleen een actie-regel zolang die daadwerkelijk relevant is
 *    (nog niet aangevraagd).
 * 2. Abonnement en Pakketten (allebei van nature lange/brede blokken die
 *    de meeste leveranciers niet bij elk bezoek hoeven te zien) staan nu in
 *    een CollapsibleSection, dicht bij binnenkomst. "Profiel aankleden"
 *    idem, binnen hetzelfde formulier als de rest (zie Collapsible.tsx
 *    voor waarom dat via CSS verborgen wordt i.p.v. ongemount).
 * 3. Spotlight hoorde hier niet: het is geen profielgegeven maar een
 *    promotie-actie — verplaatst naar de nieuwe /supplier/marketing.
 *    Prestatiecijfers (reactietijd, beoordeling) stonden nergens — die
 *    horen ook niet hier, en krijgen een eigen /supplier/analytics.
 */
export default async function SupplierProfilePage(props: PageProps<"/supplier/profile">) {
  const params = await props.searchParams;
  const hasError = params.error === "1";
  const justSaved = params.saved === "1";
  const uploadFailed = params.uploadError === "1";
  const capApplied = params.capApplied === "1";
  const verifyError = params.verifyError === "1";
  const verifyRequested = params.verifyRequested === "1";
  const packagesSaved = params.packagesSaved === "1";
  const videoError = params.videoError === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");
  const commissionStatus = await getSupplierCommissionStatus(supplier.id);
  const tierDefinition = await getSupplierEffectiveTierDefinition(supplier.id);
  const packageByTier = new Map(supplier.packages.map((p) => [p.tier, p]));

  return (
    // Het abonnementenblok hieronder (SubscriptionTierPicker) is een
    // vergelijkingstabel met vijf kolommen — die heeft veel meer breedte
    // nodig dan de rest van dit (bewust smalle) formulier. Vandaar dat de
    // buitenste container hier breder is (max-w-5xl) en de overige
    // secties elk in hun eigen smalle `max-w-lg`-wrapper zitten: alleen het
    // abonnementenblok mag de volle breedte gebruiken.
    <div className="mx-auto max-w-5xl">
      <div className="mx-auto max-w-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-ink">Bedrijfsprofiel</h1>
            <p className="mt-1 text-ink-soft">Dit bepaalt bij welke aanvragen je wordt gematcht — en is ook wat organisatoren van je zien.</p>
          </div>
          {supplier.verified ? (
            <Badge tone="success" icon={<BadgeCheck className="size-3.5" />}>Geverifieerd</Badge>
          ) : supplier.verificationRequestedAt ? (
            <Badge tone="ochre" icon={<Clock className="size-3.5" />}>Aanvraag in behandeling</Badge>
          ) : (
            <Badge tone="neutral">Nog niet geverifieerd</Badge>
          )}
        </div>

        <Link
          href={`/leveranciers/${supplier.id}`}
          target="_blank"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-sage hover:underline"
        >
          Bekijk je openbare profiel <ExternalLink className="size-3.5" />
        </Link>

        {!supplier.verified && !supplier.verificationRequestedAt && (
          <form action={requestSupplierVerificationAction} className="mt-3 flex flex-wrap items-center gap-2.5">
            <button type="submit" className="lift-hover rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90">
              Verificatie aanvragen
            </button>
            <span className="text-xs text-ink-faint">Eerst een geldig KVK-nummer (8 cijfers) invullen bij Basisgegevens.</span>
          </form>
        )}
        {verifyError && (
          <p className="mt-3 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Vul eerst een geldig KVK-nummer (precies 8 cijfers) in bij Basisgegevens voordat je verificatie kunt aanvragen.
          </p>
        )}
        {verifyRequested && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> Verificatie aangevraagd — we laten je weten zodra deze is behandeld.
          </p>
        )}

        {justSaved && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" /> Je profiel is opgeslagen.
          </div>
        )}
        {hasError && (
          <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Vul alle verplichte velden in voordat je opslaat.
          </div>
        )}
        {uploadFailed && (
          <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Je overige wijzigingen zijn opgeslagen, maar minstens één foto kon niet worden geüpload. Probeer het opnieuw, of neem contact op als dit blijft gebeuren.
          </div>
        )}
        {capApplied && (
          <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Je wijzigingen zijn opgeslagen, maar één of meer velden (categorieën, foto&apos;s of werkgebied) zijn afgekapt tot het maximum
            van je huidige abonnementsniveau. Open hieronder &quot;Abonnement&quot; om een hoger niveau te kiezen.
          </div>
        )}
        {videoError && (
          <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Je overige wijzigingen zijn opgeslagen, maar de videolink werd niet herkend als een YouTube- of Vimeo-link. Probeer het
            opnieuw met bijvoorbeeld <span className="font-mono">https://youtu.be/...</span> of <span className="font-mono">https://vimeo.com/...</span>.
          </div>
        )}

        <Card className="mt-6">
        <form action={updateSupplierProfileAction} encType="multipart/form-data" className="space-y-5">
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">Basisgegevens</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Bedrijfsnaam" required>
                  <Input name="companyName" required defaultValue={supplier.companyName} />
                </Field>
                <Field label="Contactpersoon" required>
                  <Input name="contactPerson" required defaultValue={supplier.contactPerson} />
                </Field>
              </div>

              <Field label="KVK-nummer" hint="Optioneel — versterkt vertrouwen bij organisatoren">
                <Input name="kvkNumber" defaultValue={supplier.kvkNumber ?? ""} placeholder="12345678" />
              </Field>

              <Field label="Website" hint="Optioneel">
                <Input name="website" type="url" defaultValue={supplier.website ?? ""} placeholder="https://jouwbedrijf.nl" />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Facebook" hint="Optioneel">
                  <Input name="socialFacebook" defaultValue={supplier.socialFacebook ?? ""} placeholder="facebook.com/..." />
                </Field>
                <Field label="Instagram" hint="Optioneel">
                  <Input name="socialInstagram" defaultValue={supplier.socialInstagram ?? ""} placeholder="instagram.com/..." />
                </Field>
                <Field label="TikTok" hint="Optioneel">
                  <Input name="socialTiktok" defaultValue={supplier.socialTiktok ?? ""} placeholder="tiktok.com/@..." />
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t border-line-soft pt-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">Diensten & werkgebied</h2>
            <div className="space-y-4">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-ink">Categorieën <span className="text-clay">*</span></legend>
                <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-line p-3">
                  {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        name="categories"
                        value={key}
                        defaultChecked={(supplier.categories as string[]).includes(key)}
                        className="size-4 rounded border-line text-clay accent-clay"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">Je kunt er meerdere kiezen als je bedrijf meer diensten aanbiedt.</p>
              </fieldset>

              <Field label="Andere categorie" hint="Optioneel — vul dit in als er geen categorie precies past">
                <Input name="categoryOther" defaultValue={supplier.categoryOther ?? ""} placeholder="Bijv. Ceremoniemeester" />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Vestigingsplaats / postcode" required hint="Middelpunt van je werkgebied">
                  <Input name="baseLocation" required defaultValue={supplier.baseLocation} />
                </Field>
                <Field label="Straal (km)" required hint="Tot hoever wil je rijden?">
                  <Input name="serviceRadiusKm" type="number" min={1} step={1} required defaultValue={supplier.serviceRadiusKm} />
                </Field>
              </div>

              <SupplierDescriptionField
                defaultValue={supplier.description}
                companyName={supplier.companyName}
                categoryLabels={supplier.categories.map((c) => SUPPLIER_CATEGORY_LABELS[c])}
                tagline={supplier.tagline}
                assistantEnabled={tierDefinition.assistantTier >= 2}
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Startprijs (€)" required hint="Vanaf-prijs">
                  <Input name="minPrice" type="number" min={0} step={1} required defaultValue={Math.round(supplier.minPriceCents / 100)} />
                </Field>
                <Field label="Gemiddelde prijs (€)" required hint="Typische orderwaarde">
                  <Input name="avgPrice" type="number" min={0} step={1} required defaultValue={Math.round(supplier.avgPriceCents / 100)} />
                </Field>
              </div>
            </div>
          </div>

          <div className="border-t border-line-soft pt-5">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-ink-faint">Logo &amp; foto&apos;s</h2>
            <div className="space-y-4">
              <Field label="Logo" hint="Optioneel — vierkante afbeelding werkt het best">
                <div className="flex items-center gap-3">
                  {supplier.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={supplier.logoUrl} alt="Huidig logo" className="size-12 rounded-xl border border-line object-cover" />
                  )}
                  <input
                    type="file"
                    name="logo"
                    accept="image/*"
                    className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-paper-dim file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
                  />
                </div>
              </Field>

              <Field label="Foto's" hint="Optioneel — zelf gemaakte foto's van je werk, of screenshots vanaf social media">
                <input
                  type="file"
                  name="gallery"
                  accept="image/*"
                  multiple
                  className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-paper-dim file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
                />
              </Field>

              {supplier.galleryUrls.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {supplier.galleryUrls.map((url) => (
                    <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        formAction={removeSupplierGalleryImageAction.bind(null, url)}
                        type="submit"
                        aria-label="Foto verwijderen"
                        className="absolute right-1 top-1 rounded-full bg-ink/70 p-1.5 text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {supplier.galleryUrls.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-ink-faint"><ImagePlus className="size-3.5" /> Nog geen foto&apos;s geüpload.</p>
              )}
            </div>
          </div>

          <div className="border-t border-line-soft pt-5">
            <CollapsibleSection
              title="Profiel aankleden"
              description="Optioneel — hoe hoger je abonnement, hoe meer je hiervan kunt gebruiken om je profiel een eigen gezicht te geven."
            >
              <div className="space-y-4">
                {tierDefinition.taglineEnabled ? (
                  <Field label="Korte pitch/tagline" hint='Optioneel — bv. "Al 15 jaar dé cateraar voor bruiloften in Utrecht"'>
                    <Input name="tagline" defaultValue={supplier.tagline ?? ""} maxLength={120} />
                  </Field>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink-faint">
                    <Lock className="size-3.5 shrink-0" /> Korte pitch/tagline — beschikbaar vanaf het Groei-abonnement.
                  </p>
                )}

                {tierDefinition.coverPhotoEnabled ? (
                  <Field label="Coverfoto" hint="Optioneel — brede afbeelding boven je profiel, bv. 1600×500">
                    <div className="flex items-center gap-3">
                      {supplier.coverPhotoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={supplier.coverPhotoUrl} alt="Huidige coverfoto" className="h-12 w-20 rounded-xl border border-line object-cover" />
                      )}
                      <input
                        type="file"
                        name="coverPhoto"
                        accept="image/*"
                        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-paper-dim file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
                      />
                    </div>
                  </Field>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink-faint">
                    <Lock className="size-3.5 shrink-0" /> Coverfoto — beschikbaar vanaf het Pro-abonnement.
                  </p>
                )}

                {tierDefinition.introVideoEnabled ? (
                  <Field label="Introductievideo" hint="Optioneel — link naar een YouTube- of Vimeo-video">
                    <Input name="introVideoUrl" type="url" defaultValue={supplier.introVideoUrl ?? ""} placeholder="https://youtu.be/..." />
                  </Field>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-ink-faint">
                    <Lock className="size-3.5 shrink-0" /> Introductievideo — beschikbaar vanaf het Premium-abonnement.
                  </p>
                )}
              </div>
            </CollapsibleSection>
          </div>

          <button type="submit" className="lift-hover w-full rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark">
            Wijzigingen opslaan
          </button>
        </form>
        </Card>
      </div>

      <div className="mx-auto max-w-lg">
        <Card className="mt-6">
          <CollapsibleSection
            title="Pakketten"
            description="Bied tot 3 vaste pakketten aan op je openbare profiel — makkelijker vergelijkbaar voor organisatoren dan één lopende tekst."
          >
            {!tierDefinition.packagesEnabled ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-faint">
                Pakketten zijn beschikbaar vanaf het Pro-abonnement — open hieronder &quot;Abonnement&quot; om een hoger niveau te kiezen.
              </div>
            ) : (
              <>
                {packagesSaved && (
                  <p className="mb-4 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-3 py-2 text-sm text-success">
                    <CheckCircle2 className="size-4" /> Je pakketten zijn opgeslagen.
                  </p>
                )}
                <form action={updateSupplierPackagesAction} className="space-y-5">
                  {(["basis", "standaard", "premium"] as SupplierPackageTier[]).map((tier) => {
                    const existing = packageByTier.get(tier);
                    return (
                      <fieldset key={tier} className="rounded-xl border border-line p-3.5">
                        <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-ink">
                          <Package className="size-3.5 text-ink-faint" /> {PACKAGE_TIER_LABELS[tier]}
                        </legend>
                        <div className="space-y-3">
                          <Field label="Naam" hint="Leeg laten = dit pakket niet tonen">
                            <Input name={`package_${tier}_name`} defaultValue={existing?.name ?? ""} placeholder={`Bijv. "${PACKAGE_TIER_LABELS[tier]} pakket"`} />
                          </Field>
                          <Field label="Omschrijving">
                            <Textarea name={`package_${tier}_description`} rows={2} defaultValue={existing?.description ?? ""} />
                          </Field>
                          <Field label="Prijs (€)">
                            <Input
                              name={`package_${tier}_price`}
                              type="number"
                              min={0}
                              step={1}
                              defaultValue={existing ? Math.round(existing.priceCents / 100) : ""}
                            />
                          </Field>
                        </div>
                      </fieldset>
                    );
                  })}
                  <button type="submit" className="lift-hover w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-white hover:bg-ink/90">
                    Pakketten opslaan
                  </button>
                </form>
              </>
            )}
          </CollapsibleSection>
        </Card>
      </div>

      <Card className="mt-6">
        <CollapsibleSection
          title="Abonnement"
          badge={<Badge tone="clay">{tierDefinition.label}</Badge>}
          description={
            <>
              Je huidige niveau bepaalt hoeveel categorieën en foto&apos;s je mag gebruiken, hoe ver je werkgebied reikt, je positie in de
              matching, en de commissie op boekingen. Zie{" "}
              <Link href="/voorwaarden" target="_blank" className="text-sage hover:underline">de voorwaarden</Link> voor alle details.
            </>
          }
        >
          <SubscriptionTierPicker
            currentTier={supplier.subscriptionTier}
            inTrial={commissionStatus.inTrial}
            trialBookingsRemaining={commissionStatus.trialBookingsRemaining}
          />
        </CollapsibleSection>
      </Card>
    </div>
  );
}
