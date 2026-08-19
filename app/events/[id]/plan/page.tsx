import { notFound } from "next/navigation";
import { getEvent, getRequirements } from "@/lib/data/store";
import { Card } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";
import { RequirementToggle } from "@/components/app/RequirementToggle";
import { RequirementDraftEditor } from "@/components/app/RequirementDraftEditor";
import { LinkButton } from "@/components/ui/Button";
import { confirmRequirementsAction } from "@/lib/actions/event-actions";
import { formatCurrency } from "@/lib/config";
import { RequirementPriority } from "@/lib/types";
import { Sparkles } from "lucide-react";

const SECTIONS: { key: RequirementPriority; title: string; description: string }[] = [
  { key: "essential", title: "Essentieel", description: "Vrijwel noodzakelijk om dit evenement te laten slagen." },
  { key: "recommended", title: "Aanbevolen", description: "Draagt sterk bij aan de ervaring van je evenement." },
  { key: "optional", title: "Optioneel", description: "Leuke extra's om je evenement compleet te maken." },
];

export default async function PlanPage(props: PageProps<"/events/[id]/plan">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const requirements = await getRequirements(id);

  if (requirements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <Sparkles className="mx-auto size-8 text-sage" />
        <h2 className="mt-4 font-display text-xl text-ink">Nog geen plan gegenereerd</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">Rond eerst het AI-interview af om een plan te laten genereren.</p>
        <LinkButton href="/events/new" className="mt-5">Naar het interview</LinkButton>
      </div>
    );
  }

  const selectedCount = requirements.filter((r) => r.selected).length;
  const totalEstimated = requirements.filter((r) => r.selected).reduce((sum, r) => sum + (r.estimatedBudgetCents ?? 0), 0);

  return (
    <div className="space-y-8">
      <Card className="bg-ink text-paper">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <Sparkles className="size-3.5" /> AI-eventplan
            </div>
            <h1 className="font-display text-2xl">Ik raad {requirements.length} categorieën aan voor {event.name}</h1>
            <p className="mt-1.5 text-sm text-white/70">Je hebt er {selectedCount} geselecteerd. Je kunt elke aanbeveling zelf aan- of uitzetten.</p>
          </div>
          <div className="rounded-xl bg-white/10 px-5 py-3 text-right">
            <p className="text-xs text-white/60">Geschat totaal</p>
            <p className="font-display text-2xl">{formatCurrency(totalEstimated)}</p>
            {event.budget && <p className="text-xs text-white/60">van {formatCurrency(event.budget.totalCents)} budget</p>}
          </div>
        </div>
      </Card>

      {SECTIONS.map((section) => {
        const items = requirements.filter((r) => r.priority === section.key);
        if (items.length === 0) return null;
        return (
          <div key={section.key}>
            <div className="mb-3 flex items-center gap-2.5">
              <h2 className="font-display text-lg text-ink">{section.title}</h2>
              <PriorityBadge priority={section.key} />
            </div>
            <p className="mb-3 text-sm text-ink-faint">{section.description}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {items.map((r) => (
                <Card key={r.id} className={r.selected ? "" : "opacity-60"}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{r.label}</p>
                      {r.estimatedBudgetCents != null && <p className="mt-0.5 text-sm text-ink-faint">≈ {formatCurrency(r.estimatedBudgetCents)}</p>}
                    </div>
                    <RequirementToggle eventId={id} categoryId={r.id} selected={r.selected} />
                  </div>
                  <div className="mt-3 flex items-start gap-1.5 rounded-xl bg-sage-50 px-3 py-2 text-xs text-sage-dark">
                    <Sparkles className="mt-0.5 size-3.5 shrink-0" />
                    <p>{r.aiRationale}</p>
                  </div>
                  {r.selected && <RequirementDraftEditor eventId={id} categoryId={r.id} initialMessage={r.draftMessage} />}
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex flex-col items-center gap-3 border-t border-line-soft pt-8 text-center">
        <p className="text-sm text-ink-soft">Klaar? We sturen automatisch aanvragen naar de best passende leveranciers voor je geselecteerde categorieën.</p>
        <form action={confirmRequirementsAction.bind(null, id)}>
          <button type="submit" className="lift-hover inline-flex items-center gap-2 rounded-xl bg-clay px-7 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-clay-dark">
            Bevestig selectie ({selectedCount}) en ga verder
          </button>
        </form>
      </div>
    </div>
  );
}
