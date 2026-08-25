import { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  getBudgetSummary,
  getEvent,
  getOffersForEvent,
  getRequestsForEvent,
  getRequirements,
  getTasks,
  getTimeline,
} from "@/lib/data/store";
import { getBudgetAdvice } from "@/lib/ai/assistant";
import { Card } from "@/components/ui/Card";
import { PriorityBadge, RequirementStatusBadge, AiTag } from "@/components/ui/Badge";
import { BudgetAllocator } from "@/components/app/BudgetAllocator";
import { EditableBudgetTotal } from "@/components/app/EditableBudgetTotal";
import { VyrAiAdvice } from "@/components/app/VyrAiAdvice";
import { formatCurrency } from "@/lib/config";
import { AlertTriangle } from "lucide-react";

/** Categorieën waarvan de prijs al vastligt via een geaccepteerde offerte — een schuif aanpassen zou daar niets meer betekenen. */
const LOCKED_STATUSES = new Set(["confirmed", "paid", "completed"]);

export default async function BudgetPage(props: PageProps<"/events/[id]/budget">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [budget, allRequirements, requests, offers, tasks, timeline] = await Promise.all([
    getBudgetSummary(id),
    getRequirements(id),
    getRequestsForEvent(id),
    getOffersForEvent(id),
    getTasks(id),
    getTimeline(id),
  ]);
  const requirements = allRequirements.filter((r) => r.selected);
  const advice = await getBudgetAdvice({ event, requirements, requests, offers, budget, tasks, timeline });

  // Alleen categorieën die nog "open" staan horen in de schuiven hieronder —
  // is de prijs al vastgelegd via een geaccepteerde offerte, dan verandert
  // een schatting bijstellen niets meer aan wat je daadwerkelijk betaalt.
  // Precies dezelfde selectie als `pendingCents` hierboven (getBudgetSummary
  // in lib/data/store.ts), zodat het bedrag dat je hier verdeelt exact het
  // "Verwacht"-bedrag is.
  const allocatorItems = requirements
    .filter((r) => r.estimatedBudgetCents != null && !LOCKED_STATUSES.has(r.status))
    .map((r) => ({ categoryId: r.id, label: r.label, cents: r.estimatedBudgetCents! }));

  const committedPct = budget.totalCents ? Math.min(100, (budget.committedCents / budget.totalCents) * 100) : 0;
  const pendingPct = budget.totalCents ? Math.min(100 - committedPct, (budget.pendingCents / budget.totalCents) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 font-display text-2xl text-ink">Budget</h1>
        <p className="text-sm text-ink-faint">Overzicht van je budget voor {event.name}.</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
          <EditableBudgetTotal eventId={id} totalCents={budget.totalCents} />
          <Stat label="Gecommitteerd" value={formatCurrency(budget.committedCents)} tone="text-success" />
          <Stat label="Verwacht" value={formatCurrency(budget.pendingCents)} tone="text-ochre" />
          <Stat label="Resterend" value={formatCurrency(budget.remainingCents)} tone={budget.remainingCents < 0 ? "text-danger" : "text-ink"} />
        </div>

        <div className="relative mt-6 h-3 w-full overflow-hidden rounded-full bg-paper-dim">
          <div className="absolute inset-y-0 left-0 bg-success" style={{ width: `${committedPct}%` }} />
          <div className="absolute inset-y-0 bg-ochre" style={{ left: `${committedPct}%`, width: `${pendingPct}%` }} />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-ink-faint">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Gecommitteerd</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ochre" /> Verwacht</span>
        </div>

        {budget.percentOverBudget > 0 && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Je zit momenteel {budget.percentOverBudget}% boven je oorspronkelijke budget.</p>
          </div>
        )}

        <VyrAiAdvice className="mt-5">
          <p>{advice.answer}</p>
        </VyrAiAdvice>
      </Card>

      {allocatorItems.length > 0 && (
        <Card>
          {/* Zelfde remount-op-selectiewijziging-truc als op de planpagina — zie de toelichting daar. */}
          <BudgetAllocator
            key={allocatorItems.map((i) => i.categoryId).join(",")}
            eventId={id}
            items={allocatorItems}
            totalBudgetCents={event.budget?.totalCents ?? null}
            variant="light"
          />
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-display text-lg text-ink">Verdeling per categorie</h2>
        {requirements.length === 0 ? (
          <p className="text-sm text-ink-faint">Nog geen categorieën geselecteerd — rond het AI-eventplan af om hier een verdeling te zien.</p>
        ) : (
        <div className="divide-y divide-line-soft">
          {requirements.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2.5">
                <span className="font-medium text-ink">{r.label}</span>
                <PriorityBadge priority={r.priority} />
              </div>
              <div className="flex items-center gap-3">
                {r.estimatedBudgetCents != null && <span className="text-sm text-ink-faint">{formatCurrency(r.estimatedBudgetCents)}</span>}
                <RequirementStatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
        )}
        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
          <AiTag /> Budgetverdeling is VyrAI-advies op basis van je eventgegevens — pas het gerust aan.
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
        {icon}
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl ${tone ?? "text-ink"}`}>{value}</p>
    </div>
  );
}
