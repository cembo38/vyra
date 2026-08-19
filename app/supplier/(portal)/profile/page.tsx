import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner } from "@/lib/data/store";
import { updateSupplierProfileAction, removeSupplierGalleryImageAction, requestSupplierVerificationAction } from "@/lib/actions/supplier-actions";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { BadgeCheck, CheckCircle2, Clock, ExternalLink, ImagePlus, X } from "lucide-react";

export const metadata = { title: "Bedrijfsprofiel — Vyra voor leveranciers" };

export default async function SupplierProfilePage(props: PageProps<"/supplier/profile">) {
  const params = await props.searchParams;
  const hasError = params.error === "1";
  const justSaved = params.saved === "1";
  const uploadFailed = params.uploadError === "1";
  const verifyError = params.verifyError === "1";
  const verifyRequested = params.verifyRequested === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  return (
    <div className="mx-auto max-w-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">Bedrijfsprofiel</h1>
          <p className="mt-1 text-ink-soft">Dit bepaalt bij welke aanvragen je wordt gematcht — en is ook wat organisatoren van je zien.</p>
        </div>
      </div>

      <Link
        href={`/leveranciers/${supplier.id}`}
        target="_blank"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-sage hover:underline"
      >
        Bekijk je openbare profiel <ExternalLink className="size-3.5" />
      </Link>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">Verificatie</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Een geverifieerd profiel wekt vertrouwen bij organisatoren: we controleren je bedrijfsgegevens handmatig.
            </p>
          </div>
          {supplier.verified ? (
            <Badge tone="success" icon={<BadgeCheck className="size-3.5" />}>Geverifieerd</Badge>
          ) : supplier.verificationRequestedAt ? (
            <Badge tone="ochre" icon={<Clock className="size-3.5" />}>Aanvraag in behandeling</Badge>
          ) : (
            <Badge tone="neutral">Nog niet geverifieerd</Badge>
          )}
        </div>
        {!supplier.verified && !supplier.verificationRequestedAt && (
          <form action={requestSupplierVerificationAction} className="mt-3">
            <button type="submit" className="lift-hover rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-ink/90">
              Verificatie aanvragen
            </button>
            <p className="mt-1.5 text-xs text-ink-faint">Vul eerst je KVK-nummer hieronder in — dat heeft een admin nodig om je te kunnen verifiëren.</p>
          </form>
        )}
        {verifyError && (
          <p className="mt-3 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
            Vul eerst je KVK-nummer in bij Basisgegevens voordat je verificatie kunt aanvragen.
          </p>
        )}
        {verifyRequested && (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-success-50 bg-success-50 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> Verificatie aangevraagd — we laten je weten zodra deze is behandeld.
          </p>
        )}
      </Card>

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

              <Field label="Beschrijving" required hint="Wat maakt jouw bedrijf bijzonder? Dit zien organisatoren bij een aanvraag.">
                <Textarea name="description" required rows={3} defaultValue={supplier.description} />
              </Field>

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

          <button type="submit" className="lift-hover w-full rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark">
            Wijzigingen opslaan
          </button>
        </form>
      </Card>
    </div>
  );
}
