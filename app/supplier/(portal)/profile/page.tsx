import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner } from "@/lib/data/store";
import { updateSupplierProfileAction } from "@/lib/actions/supplier-actions";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Bedrijfsprofiel — Vyra voor leveranciers" };

export default async function SupplierProfilePage(props: PageProps<"/supplier/profile">) {
  const params = await props.searchParams;
  const hasError = params.error === "1";
  const justSaved = params.saved === "1";

  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl text-ink">Bedrijfsprofiel</h1>
      <p className="mt-1 text-ink-soft">Dit bepaalt bij welke aanvragen je wordt gematcht. Organisatoren zien deze gegevens niet rechtstreeks, maar je matching en profielkwaliteit hangen ervan af.</p>

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

      <Card className="mt-6">
        <form action={updateSupplierProfileAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bedrijfsnaam" required>
              <Input name="companyName" required defaultValue={supplier.companyName} />
            </Field>
            <Field label="Contactpersoon" required>
              <Input name="contactPerson" required defaultValue={supplier.contactPerson} />
            </Field>
          </div>

          <Field label="Categorie" required>
            <Select name="category" required defaultValue={supplier.category}>
              {Object.entries(SUPPLIER_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Werkgebied" required hint="Steden of regio's, gescheiden door komma's">
            <Input name="serviceAreas" required defaultValue={supplier.serviceAreas.join(", ")} />
          </Field>

          <Field label="Beschrijving" required hint="Wat maakt jouw bedrijf bijzonder? Dit zien organisatoren bij een aanvraag.">
            <Textarea name="description" required rows={3} defaultValue={supplier.description} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Startprijs (€)" required hint="Vanaf-prijs">
              <Input name="minPrice" type="number" min={0} step={1} required defaultValue={Math.round(supplier.minPriceCents / 100)} />
            </Field>
            <Field label="Gemiddelde prijs (€)" required hint="Typische orderwaarde">
              <Input name="avgPrice" type="number" min={0} step={1} required defaultValue={Math.round(supplier.avgPriceCents / 100)} />
            </Field>
          </div>

          <button type="submit" className="w-full rounded-full bg-coral py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-dark">
            Wijzigingen opslaan
          </button>
        </form>
      </Card>
    </div>
  );
}
