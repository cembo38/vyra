import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth-actions";
import { getSupplierAccountByOwner } from "@/lib/data/store";
import { createSupplierProfileAction } from "@/lib/actions/supplier-actions";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";

export const metadata = { title: "Bedrijfsprofiel — Vyra voor leveranciers" };

export default async function SupplierOnboardingPage(props: PageProps<"/supplier/onboarding">) {
  const params = await props.searchParams;
  const hasError = params.error === "1";

  // Bij een mislukte poging stuurt createSupplierProfileAction alle
  // ingevulde velden terug als queryparams, zodat dit (lange, 9-velden)
  // formulier voorgevuld blijft staan i.p.v. helemaal leeg terug te komen.
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const prevCompanyName = str(params.companyName);
  const prevContactPerson = str(params.contactPerson);
  const prevCategoryOther = str(params.categoryOther);
  const prevBaseLocation = str(params.baseLocation);
  const prevServiceRadiusKm = str(params.serviceRadiusKm) || "25";
  const prevDescription = str(params.description);
  const prevMinPrice = str(params.minPrice);
  const prevAvgPrice = str(params.avgPrice);
  const prevKvkNumber = str(params.kvkNumber);
  const prevCategories = new Set(Array.isArray(params.categories) ? params.categories : params.categories ? [params.categories] : []);

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const existing = await getSupplierAccountByOwner(user.id);
  if (existing) redirect("/supplier/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <span className="text-xs font-medium uppercase tracking-wide text-clay">Laatste stap</span>
          <h1 className="mt-1 font-display text-2xl text-ink">Richt je bedrijfsprofiel in</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Dit bepaalt bij welke aanvragen je wordt gematcht. Je kunt dit later aanpassen.
          </p>

          {hasError && (
            <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
              Vul alle verplichte velden in voordat je verdergaat.
            </div>
          )}

          <form action={createSupplierProfileAction} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bedrijfsnaam" required>
                <Input name="companyName" required placeholder="Bijv. Bloom & Co." defaultValue={prevCompanyName} />
              </Field>
              <Field label="Contactpersoon" required>
                <Input name="contactPerson" required placeholder="Jouw naam" defaultValue={prevContactPerson} />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Categorieën <span className="text-clay">*</span></legend>
              <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-line p-3">
                {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      name="categories"
                      value={key}
                      defaultChecked={prevCategories.has(key)}
                      className="size-4 rounded border-line text-clay accent-clay"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">Je kunt er meerdere kiezen als je bedrijf meer diensten aanbiedt.</p>
            </fieldset>

            <Field label="Andere categorie" hint="Optioneel — vul dit in als er geen categorie precies past">
              <Input name="categoryOther" placeholder="Bijv. Ceremoniemeester" defaultValue={prevCategoryOther} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Vestigingsplaats / postcode" required hint="Middelpunt van je werkgebied">
                <Input name="baseLocation" required placeholder="Utrecht" defaultValue={prevBaseLocation} />
              </Field>
              <Field label="Straal (km)" required hint="Tot hoever wil je rijden?">
                <Input name="serviceRadiusKm" type="number" min={1} step={1} required defaultValue={prevServiceRadiusKm} />
              </Field>
            </div>

            <Field label="Beschrijving" required hint="Wat maakt jouw bedrijf bijzonder? Dit zien organisatoren bij een aanvraag.">
              <Textarea name="description" required rows={3} placeholder="Bijv. 'Culinaire catering met seizoensmenu's, gespecialiseerd in bruiloften en premium feesten.'" defaultValue={prevDescription} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Startprijs (€)" required hint="Vanaf-prijs">
                <Input name="minPrice" type="number" min={0} step={1} required placeholder="500" defaultValue={prevMinPrice} />
              </Field>
              <Field label="Gemiddelde prijs (€)" required hint="Typische orderwaarde">
                <Input name="avgPrice" type="number" min={0} step={1} required placeholder="850" defaultValue={prevAvgPrice} />
              </Field>
            </div>

            {/* "Onboarding: foto + KVK + pakketten-nudge" (livegang-audit) —
                allebei optioneel, precies zoals bij de latere profielbewerking
                (app/supplier/(portal)/profile/page.tsx), maar nu meteen
                aangeboden i.p.v. pas later: een profiel met logo en
                KVK-nummer oogt vanaf dag één vertrouwder voor organisatoren,
                en scheelt een aparte trip terug naar het profiel. */}
            <div className="border-t border-line-soft pt-4">
              <Field label="Logo" hint="Optioneel — kan ook later, vierkante afbeelding werkt het best">
                <input
                  type="file"
                  name="logo"
                  accept="image/*"
                  className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-paper-dim file:px-3.5 file:py-2 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
                />
              </Field>
              <div className="mt-3">
                <Field label="KVK-nummer" hint="Optioneel — versterkt vertrouwen bij organisatoren en is nodig om verificatie aan te vragen">
                  <Input name="kvkNumber" placeholder="12345678" defaultValue={prevKvkNumber} />
                </Field>
              </div>
            </div>

            <button type="submit" className="lift-hover w-full rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark">
              Profiel opslaan en naar dashboard
            </button>
          </form>
        </div>

        {/* Voorheen een doodlopend eind: geen navigatie, geen manier om weg
            te komen als je bijvoorbeeld per ongeluk met het verkeerde
            account bent ingelogd. */}
        <form action={logoutAction} className="mt-4 text-center">
          <p className="text-xs text-ink-faint">
            Ingelogd als {user.email} ·{" "}
            <button type="submit" className="font-medium text-clay hover:underline">Uitloggen</button>
          </p>
        </form>
      </div>
    </div>
  );
}
