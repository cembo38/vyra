import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { SpotlightPanel } from "@/components/app/SpotlightPanel";
import { getCurrentUser } from "@/lib/auth";
import {
  getActiveSpotlightsForSupplier,
  countSpotlightActivationsThisMonth,
  getSupplierAccountByOwner,
  getSupplierCommissionStatus,
} from "@/lib/data/store";
import { SPOTLIGHT_MONTHLY_QUOTA } from "@/lib/config";
import { Flashlight } from "lucide-react";

export const metadata = { title: "Marketing — Vyra voor leveranciers" };

/**
 * Cem (aug. 2026): "de rest dat eigenlijk niet toebehoord op deze pagina
 * [het bedrijfsprofiel]... maak een gepaste pagina daarvoor aan (bijv
 * marketing)" — Spotlight is geen profielgegeven (het beschrijft niet wie
 * je bent), maar een actie die je onderneemt om tijdelijk meer aandacht te
 * krijgen. Hoort dus bij "promotie", niet bij "identiteit". Startpunt voor
 * verdere marketing-tools (zie het eerdere voorstel voor extra
 * leveranciersportaal-pagina's: pay-as-you-go spotlights, verwijsprogramma).
 */
export default async function SupplierMarketingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const commissionStatus = await getSupplierCommissionStatus(supplier.id);
  const [activeSpotlights, spotlightsUsedThisMonth] = await Promise.all([
    getActiveSpotlightsForSupplier(supplier.id),
    countSpotlightActivationsThisMonth(supplier.id),
  ]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl text-ink">Marketing</h1>
      <p className="mt-1 text-ink-soft">Zet tijdelijk extra aandacht op je aanbod in de openbare zoekresultaten.</p>

      <Card className="mt-6">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-ink-faint">
            <Flashlight className="size-3.5" /> Spotlight
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Zet tijdelijk extra aandacht op één van je categorieën in de openbare zoekresultaten.
          </p>
        </div>
        <div className="mt-4">
          <SpotlightPanel
            categories={supplier.categories}
            activeSpotlights={activeSpotlights}
            quota={SPOTLIGHT_MONTHLY_QUOTA[commissionStatus.tier]}
            usedThisMonth={spotlightsUsedThisMonth}
          />
        </div>
      </Card>
    </div>
  );
}
