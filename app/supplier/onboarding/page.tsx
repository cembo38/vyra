import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner } from "@/lib/data/store";
import { createSupplierProfileAction } from "@/lib/actions/supplier-actions";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";

export const metadata = { title: "Bedrijfsprofiel — Vyra voor leveranciers" };

export default async function SupplierOnboardingPage(props: PageProps<"/supplier/onboarding">) {
  const params = await props.searchParams;
  const hasError = params.error === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const existing = await getSupplierAccountByOwner(user.id);
  if (existing) redirect("/supplier/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <span className="text-xs font-medium uppercase tracking-wide text-coral">Laatste stap</span>
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
                <Input name="companyName" required placeholder="Bijv. Bloom & Co." />
              </Field>
              <Field label="Contactpersoon" required>
                <Input name="contactPerson" required placeholder="Jouw naam" />
              </Field>
            </div>

            <Field label="Categorie" required>
              <Select name="category" required defaultValue="">
                <option value="" disabled>Kies je categorie</option>
                {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Werkgebied" required hint="Steden of regio's, gescheiden door komma's">
              <Input name="serviceAreas" required placeholder="Amsterdam, Utrecht, Haarlem" />
            </Field>

            <Field label="Beschrijving" required hint="Wat maakt jouw bedrijf bijzonder? Dit zien organisatoren bij een aanvraag.">
              <Textarea name="description" required rows={3} placeholder="Bijv. 'Culinaire catering met seizoensmenu's, gespecialiseerd in bruiloften en premium feesten.'" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Startprijs (€)" required hint="Vanaf-prijs">
                <Input name="minPrice" type="number" min={0} step={1} required placeholder="500" />
              </Field>
              <Field label="Gemiddelde prijs (€)" required hint="Typische orderwaarde">
                <Input name="avgPrice" type="number" min={0} step={1} required placeholder="850" />
              </Field>
            </div>

            <button type="submit" className="w-full rounded-full bg-coral py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-dark">
              Profiel opslaan en naar dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
