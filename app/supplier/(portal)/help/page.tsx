import { FaqPage } from "@/components/app/FaqPage";
import { SUPPLIER_FAQ } from "@/lib/faq-content";

export const metadata = { title: "Help & FAQ — Vyra voor leveranciers" };

const SUGGESTIONS = ["Hoe werkt de proefperiode?", "Wat gebeurt er als ik van abonnement wissel?", "Hoe stel ik snel een offerte samen?"];

// Inlog- en profielcheck gebeuren al in app/supplier/(portal)/layout.tsx —
// deze pagina hoeft dat niet nog eens te doen (zelfde patroon als de andere
// pagina's in dit route-segment, bv. analytics/marketing/orders).
export default function SupplierHelpPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <FaqPage
        audience="supplier"
        title="Help & FAQ"
        intro="Alles wat je wilt weten over aanvragen, abonnementen en VyrAI als leverancier op Vyra."
        categories={SUPPLIER_FAQ}
        suggestions={SUGGESTIONS}
      />
    </div>
  );
}
