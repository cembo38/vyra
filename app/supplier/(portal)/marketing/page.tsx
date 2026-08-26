import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ReferralSection } from "@/components/app/ReferralSection";
import { SpotlightPanel } from "@/components/app/SpotlightPanel";
import { getCurrentUser } from "@/lib/auth";
import {
  countReferrals,
  getActiveSpotlightsForSupplier,
  countSpotlightActivationsThisMonth,
  getPendingSpotlightBoostRequest,
  getSupplierAccountByOwner,
  getSupplierCommissionStatus,
} from "@/lib/data/store";
import { SITE_URL, SPOTLIGHT_MONTHLY_QUOTA } from "@/lib/config";
import { Flashlight, Users } from "lucide-react";

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
  const [activeSpotlights, spotlightsUsedThisMonth, pendingBoostRequest, referralCount] = await Promise.all([
    getActiveSpotlightsForSupplier(supplier.id),
    countSpotlightActivationsThisMonth(supplier.id),
    getPendingSpotlightBoostRequest(supplier.id),
    countReferrals(user.id),
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
            bonusCredits={supplier.bonusSpotlightCredits}
            pendingBoostRequest={pendingBoostRequest}
          />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-ink-faint">
          <Users className="size-3.5" /> Referral-programma
        </h2>
        <div className="mt-4">
          <ReferralSection referralUrl={`${SITE_URL}/signup?ref=${user.id}`} referralCount={referralCount} showSpotlightNote />
        </div>
      </Card>
    </div>
  );
}
