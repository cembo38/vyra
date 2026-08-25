import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth";
import { getSupplierAccountByOwner, getSupplierEffectiveTierDefinition, getSupplierPerformanceInsights } from "@/lib/data/store";
import { buildSupplierPriceAdvice } from "@/lib/ai/supplierAssistantMock";
import { formatCurrency } from "@/lib/config";
import { SUPPLIER_CATEGORY_LABELS } from "@/lib/types";
import { Clock, Lock, Sparkles, Star, TrendingDown, TrendingUp } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analyse — Vyra voor leveranciers" };

/**
 * Cem (aug. 2026): "de rest dat eigenlijk niet toebehoord op deze pagina
 * [het bedrijfsprofiel]... maak analytics pagina zodat leveranciers kunnen
 * zien hoe en wat" — reactietijd en beoordeling stonden nergens
 * gepresenteerd, terwijl de cijfers er al waren (zie getSupplierPerformance
 * Insights in lib/data/store.ts voor precies welke velden echt zijn en
 * welke bewust zijn weggelaten).
 */
export default async function SupplierAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supplier = await getSupplierAccountByOwner(user.id);
  if (!supplier) redirect("/supplier/onboarding");

  const [insights, tierDefinition] = await Promise.all([
    getSupplierPerformanceInsights(supplier.id),
    getSupplierEffectiveTierDefinition(supplier.id),
  ]);
  const categoryLabel = SUPPLIER_CATEGORY_LABELS[supplier.category];
  const priceAdviceEnabled = tierDefinition.assistantTier >= 2;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-ink">Analyse</h1>
      <p className="mt-1 text-ink-soft">Hoe je presteert ten opzichte van andere {categoryLabel.toLowerCase()}-leveranciers op Vyra.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <MetricHeader icon={<Clock className="size-4" />} label="Gemiddelde reactietijd" />
          <p className="mt-2 font-display text-3xl text-ink">{insights.avgResponseHours} uur</p>

          {insights.categoryAvgResponseHours == null ? (
            <p className="mt-3 text-xs text-ink-faint">
              Nog geen andere {categoryLabel.toLowerCase()}-leveranciers om mee te vergelijken.
            </p>
          ) : (
            <>
              <Takeaway
                good={insights.avgResponseHours <= insights.categoryAvgResponseHours}
                goodText="Je reageert sneller dan het categoriegemiddelde."
                badText="Je reageert langzamer dan het categoriegemiddelde."
              />
              <div className="mt-4 space-y-2.5">
                <BenchmarkBar label="Jij" hours={insights.avgResponseHours} maxHours={Math.max(insights.avgResponseHours, insights.categoryAvgResponseHours)} tone="clay" />
                <BenchmarkBar
                  label="Categoriegemiddelde"
                  hours={insights.categoryAvgResponseHours}
                  maxHours={Math.max(insights.avgResponseHours, insights.categoryAvgResponseHours)}
                  tone="neutral"
                />
              </div>
            </>
          )}
        </Card>

        <Card>
          <MetricHeader icon={<Star className="size-4" />} label="Beoordeling" />
          {insights.ratingCount === 0 ? (
            <>
              <p className="mt-2 font-display text-3xl text-ink">—</p>
              <p className="mt-3 text-xs text-ink-faint">Nog geen beoordelingen — zodra een organisator een review achterlaat, verschijnt je gemiddelde hier.</p>
            </>
          ) : (
            <>
              <p className="mt-2 flex items-baseline gap-1.5 font-display text-3xl text-ink">
                {insights.ratingAvg.toFixed(1)}
                <span className="text-sm font-sans font-normal text-ink-faint">({insights.ratingCount} review{insights.ratingCount !== 1 ? "s" : ""})</span>
              </p>
              {insights.categoryAvgRating == null ? (
                <p className="mt-3 text-xs text-ink-faint">Nog geen andere {categoryLabel.toLowerCase()}-leveranciers met reviews om mee te vergelijken.</p>
              ) : (
                <>
                  <Takeaway
                    good={insights.ratingAvg >= insights.categoryAvgRating}
                    goodText="Je scoort boven het categoriegemiddelde."
                    badText="Je scoort onder het categoriegemiddelde."
                  />
                  <div className="mt-4 space-y-2.5">
                    <BenchmarkBar label="Jij" hours={insights.ratingAvg} maxHours={5} suffix="/5" tone="clay" />
                    <BenchmarkBar label="Categoriegemiddelde" hours={insights.categoryAvgRating} maxHours={5} suffix="/5" tone="neutral" />
                  </div>
                </>
              )}
            </>
          )}
        </Card>
      </div>

      <Card className={cn("mt-6", !priceAdviceEnabled && "border-dashed bg-paper-dim")}>
        <div className="flex items-center justify-between gap-2">
          <MetricHeader icon={<Sparkles className="motion-icon-twinkle size-4" />} label="VyrAI Prijsadvies" />
          {!priceAdviceEnabled && (
            <Link href="/supplier/profile" className="flex items-center gap-1 text-xs font-medium text-clay hover:underline">
              <Lock className="size-3" /> Vanaf Premium
            </Link>
          )}
        </div>
        {priceAdviceEnabled ? (
          insights.categoryAvgPriceCents == null ? (
            <p className="mt-3 text-sm text-ink-faint">{buildSupplierPriceAdvice(insights.avgPriceCents, insights.categoryAvgPriceCents)}</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-soft">{buildSupplierPriceAdvice(insights.avgPriceCents, insights.categoryAvgPriceCents)}</p>
              <div className="mt-4 space-y-2.5">
                <PriceBenchmarkBar label="Jij" cents={insights.avgPriceCents} maxCents={Math.max(insights.avgPriceCents, insights.categoryAvgPriceCents)} tone="clay" />
                <PriceBenchmarkBar label="Categoriegemiddelde" cents={insights.categoryAvgPriceCents} maxCents={Math.max(insights.avgPriceCents, insights.categoryAvgPriceCents)} tone="neutral" />
              </div>
            </>
          )
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Zie hoe je gemiddelde prijs zich verhoudt tot andere {categoryLabel.toLowerCase()}-leveranciers, met VyrAI-advies over je prijsstelling.</p>
        )}
      </Card>

      <p className="mt-6 text-xs text-ink-faint">
        Reactietijd wordt dagelijks herberekend op basis van je echte berichten. Categoriegemiddeldes zijn gebaseerd op {insights.categoryPeerCount} andere{" "}
        {categoryLabel.toLowerCase()}-leverancier{insights.categoryPeerCount !== 1 ? "s" : ""} op Vyra. Verdiensten en boekingen vind je op je{" "}
        <Link href="/supplier/dashboard" className="text-sage hover:underline">dashboard</Link>.
      </p>
    </div>
  );
}

function MetricHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
      {icon}
      {label}
    </div>
  );
}

function Takeaway({ good, goodText, badText }: { good: boolean; goodText: string; badText: string }) {
  return (
    <p className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", good ? "text-success" : "text-ochre")}>
      {good ? <TrendingUp className="size-3.5 shrink-0" /> : <TrendingDown className="size-3.5 shrink-0" />}
      {good ? goodText : badText}
    </p>
  );
}

function BenchmarkBar({
  label,
  hours,
  maxHours,
  suffix = " uur",
  tone,
}: {
  label: string;
  hours: number;
  maxHours: number;
  suffix?: string;
  tone: "clay" | "neutral";
}) {
  const pct = maxHours > 0 ? Math.max(4, Math.min(100, (hours / maxHours) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 text-ink-faint">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-dim">
        <div className={cn("h-full rounded-full", tone === "clay" ? "bg-clay" : "bg-line")} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right font-medium text-ink">{Number.isInteger(hours) ? hours : hours.toFixed(1)}{suffix}</span>
    </div>
  );
}

function PriceBenchmarkBar({ label, cents, maxCents, tone }: { label: string; cents: number; maxCents: number; tone: "clay" | "neutral" }) {
  const pct = maxCents > 0 ? Math.max(4, Math.min(100, (cents / maxCents) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 text-ink-faint">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-dim">
        <div className={cn("h-full rounded-full", tone === "clay" ? "bg-clay" : "bg-line")} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right font-medium text-ink">{formatCurrency(cents)}</span>
    </div>
  );
}
