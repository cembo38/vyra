import Link from "next/link";
import { notFound } from "next/navigation";
import {
  computeNextStep,
  computeReadiness,
  getBudgetSummary,
  getEvent,
  getRequirements,
  getRisks,
  getTasks,
} from "@/lib/data/store";
import { ReadinessRing, ProgressBar } from "@/components/ui/ProgressBar";
import { Card } from "@/components/ui/Card";
import { PriorityBadge, RequirementStatusBadge, AiTag } from "@/components/ui/Badge";
import { ExpandToggle } from "@/components/ui/ExpandToggle";
import { AssistantWidget } from "@/components/app/AssistantWidget";
import { NotesPanel } from "@/components/app/NotesPanel";
import { NextStepCard } from "@/components/app/NextStepCard";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/config";
import { formatDateNL } from "@/lib/utils";
import { toggleTaskAction } from "@/lib/actions/misc-actions";
import { CheckCircle2, Circle, MapPin, Sparkles, Users, Wallet } from "lucide-react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { RiskFlag } from "@/lib/types";

/** Boven dit aantal tonen Categorieën/Taken alleen het begin, met een onthouden "toon meer"-knop (ExpandToggle) voor de rest — zie de toelichting bij de herontwerp-comments verderop op deze pagina. */
const LIST_PREVIEW_COUNT = 5;

function categoryHref(eventId: string, status: string, categoryKey: string) {
  if (status === "suggested" || status === "selected") return `/events/${eventId}/plan`;
  if (status === "requested" || status === "awaiting_response") return `/events/${eventId}/requests`;
  return `/events/${eventId}/offers/${categoryKey}`;
}

/**
 * Cems feedback (sep. 2026): de gele AI-signaleringen op het dashboard
 * deden niks bij een klik — puur tekst. Elk risico krijgt sindsdien een
 * `section` mee van de AI (zie RISK_DETECTION_PROMPT/detectRisksMock), die
 * hier naar het bijbehorende tabblad wijst. `null` bij oudere, nog niet
 * geclassificeerde rijen (van vóór deze wijziging) valt terug op "plan" —
 * de meest voorkomende bestemming — in plaats van een dode link te tonen.
 */
function riskSectionHref(eventId: string, section: RiskFlag["section"]): string {
  switch (section) {
    case "instellingen":
      return `/events/${eventId}/settings`;
    case "gasten":
      return `/events/${eventId}/guests`;
    case "budget":
      return `/events/${eventId}/budget`;
    case "plan":
    default:
      return `/events/${eventId}/plan`;
  }
}

export default async function EventDashboardPage(props: PageProps<"/events/[id]">) {
  const { id } = await props.params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [readiness, budget, allRequirements, risks, tasks, nextStep] = await Promise.all([
    computeReadiness(id),
    getBudgetSummary(id),
    getRequirements(id),
    getRisks(id),
    getTasks(id),
    computeNextStep(id),
  ]);
  const requirements = allRequirements.filter((r) => r.selected);

  const openTasks = tasks.filter((t) => !t.done);
  const confirmedCount = requirements.filter((r) => ["confirmed", "paid", "completed"].includes(r.status)).length;
  const openRequestsCount = requirements.filter((r) => !["confirmed", "paid", "completed", "suggested"].includes(r.status)).length;
  const pendingDecisionCount = requirements.filter((r) => r.status === "offers_received" || r.status === "shortlisted").length;

  if (requirements.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <Sparkles className="mx-auto size-8 text-sage" />
        <h2 className="mt-4 font-display text-xl text-ink">Je eventplan is nog niet gegenereerd</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">Ga verder met het AI-interview om een compleet plan voor dit evenement te krijgen.</p>
        <LinkButton href={`/events/${id}/plan`} className="mt-5">Bekijk mijn eventplan</LinkButton>
      </div>
    );
  }

  // Herontwerp (sep. 2026, "een rustiger Overzicht-tabblad" — zie het
  // voorstel dat Cem heeft goedgekeurd): de risicomeldingen stonden hier
  // als losse kaartjes onder de NextStepCard; ze schuiven nu in als
  // onthouden-uitklapbare "andere aandachtspunten" BINNEN die kaart (zie
  // NextStepCard.tsx) — daarom hier alvast omgezet naar de vorm die dat
  // component verwacht (kant-en-klare link + boodschap).
  const riskItems = risks.map((r) => ({ id: r.id, message: r.message, href: riskSectionHref(id, r.section) }));

  const categoryPreview = requirements.slice(0, LIST_PREVIEW_COUNT);
  const categoryExtra = requirements.slice(LIST_PREVIEW_COUNT);
  const taskPreview = tasks.slice(0, LIST_PREVIEW_COUNT);
  const taskExtra = tasks.slice(LIST_PREVIEW_COUNT);

  function categoryRow(r: (typeof requirements)[number]) {
    return (
      <Link
        key={r.id}
        href={categoryHref(id, r.status, r.categoryKey)}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line-soft px-4 py-3 transition-colors hover:border-line hover:bg-paper-dim"
      >
        <div className="flex items-center gap-2.5">
          <span className="font-medium text-ink">{r.label}</span>
          <PriorityBadge priority={r.priority} />
        </div>
        <div className="flex items-center gap-3">
          {r.estimatedBudgetCents != null && <span className="text-sm text-ink-faint">{formatCurrency(r.estimatedBudgetCents)}</span>}
          <RequirementStatusBadge status={r.status} />
        </div>
      </Link>
    );
  }

  function taskRow(t: (typeof tasks)[number]) {
    return (
      <form key={t.id} action={toggleTaskAction.bind(null, id, t.id, !t.done)}>
        <SubmitButton
          pendingLabel="Bezig met bijwerken…"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-paper-dim"
        >
          {t.done ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Circle className="size-5 shrink-0 text-ink-faint" />}
          <span className={t.done ? "flex-1 text-sm text-ink-faint line-through" : "flex-1 text-sm text-ink"}>{t.title}</span>
          {!t.done && t.urgency === "urgent" && <span className="text-xs font-medium text-clay">Urgent</span>}
          {t.source === "ai_recommendation" && <AiTag className="hidden sm:inline-flex" />}
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {nextStep && <NextStepCard step={nextStep} risks={riskItems} />}

        {/*
          Voortgang (herontwerp sep. 2026): readiness-ring en budget waren
          twee aparte "hoe gaat het"-kaarten na elkaar — allebei een eigen
          rand/schaduw voor wat inhoudelijk bij elkaar hoort. Nu één kaart
          met een dunne scheidingslijn ertussen; niets van de inhoud is
          weg (de 3 mini-statistieken en de volledige budget-uitsplitsing
          staan er allebei nog, alleen niet meer los omkaderd).
        */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ReadinessRing value={readiness.score} size={72} />
              <div>
                <p className="text-sm font-medium text-ink-faint">Event readiness</p>
                <p className="font-display text-xl text-ink">{readiness.score}% compleet</p>
                {readiness.missingEssentials.length > 0 && (
                  <p className="mt-0.5 text-sm text-ink-soft">Er ontbreken nog {readiness.missingEssentials.length} essentiële onderdelen.</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="font-display text-2xl text-ink">{openRequestsCount}</p>
                <p className="text-xs text-ink-faint">Open aanvragen</p>
              </div>
              <div>
                <p className="font-display text-2xl text-success">{confirmedCount}</p>
                <p className="text-xs text-ink-faint">Bevestigd</p>
              </div>
              <div>
                <p className="font-display text-2xl text-ochre">{pendingDecisionCount}</p>
                <p className="text-xs text-ink-faint">Wacht op keuze</p>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-line-soft pt-5">
            <div className="mb-3 flex items-center gap-2 text-ink-faint">
              <Wallet className="size-4" />
              <span className="text-sm font-medium uppercase tracking-wide">Budget</span>
            </div>
            <p className="font-display text-2xl text-ink">{formatCurrency(budget.totalCents)}</p>
            <ProgressBar value={budget.totalCents ? (budget.committedCents / budget.totalCents) * 100 : 0} className="mt-3" tone={budget.percentOverBudget > 0 ? "danger" : "ink"} />
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-soft">Gecommitteerd</span><span className="font-medium text-ink">{formatCurrency(budget.committedCents)}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Verwacht</span><span className="font-medium text-ink">{formatCurrency(budget.pendingCents)}</span></div>
              <div className="flex justify-between"><span className="text-ink-soft">Resterend</span><span className="font-medium text-ink">{formatCurrency(budget.remainingCents)}</span></div>
            </div>
            {budget.percentOverBudget > 0 && (
              <p className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger">Je zit momenteel {budget.percentOverBudget}% boven je oorspronkelijke budget.</p>
            )}
            <Link href={`/events/${id}/budget`} className="mt-4 block text-sm font-medium text-clay hover:underline">Volledig budget bekijken →</Link>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Categorieën</h2>
            <Link href={`/events/${id}/plan`} className="text-sm font-medium text-clay hover:underline">
              Volledig plan bekijken
            </Link>
          </div>
          <div className="space-y-2">
            {categoryPreview.map(categoryRow)}
            {categoryExtra.length > 0 && (
              <ExpandToggle
                storageKey="dashboard-categorieen"
                moreLabel={`Nog ${categoryExtra.length} ${categoryExtra.length === 1 ? "categorie" : "categorieën"} tonen`}
                lessLabel="Toon minder"
              >
                <div className="space-y-2">{categoryExtra.map(categoryRow)}</div>
              </ExpandToggle>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Taken</h2>
            <span className="text-sm text-ink-faint">{openTasks.length} openstaand</span>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-ink-faint">Geen taken op dit moment.</p>
          ) : (
            <div className="space-y-1.5">
              {taskPreview.map(taskRow)}
              {taskExtra.length > 0 && (
                <ExpandToggle
                  storageKey="dashboard-taken"
                  moreLabel={`Nog ${taskExtra.length} ${taskExtra.length === 1 ? "taak" : "taken"} tonen`}
                  lessLabel="Toon minder"
                >
                  <div className="space-y-1.5">{taskExtra.map(taskRow)}</div>
                </ExpandToggle>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <NotesPanel eventId={id} notes={event.notes} />

        <Card>
          <div className="space-y-2 text-sm text-ink-soft">
            {event.date && <div className="flex items-center gap-2"><Sparkles className="size-4 text-ink-faint" />{formatDateNL(event.date)}</div>}
            {event.locationLabel && <div className="flex items-center gap-2"><MapPin className="size-4 text-ink-faint" />{event.locationLabel}</div>}
            {(event.guestCountAdults || event.guestCountChildren) && (
              <div className="flex items-center gap-2">
                <Users className="size-4 text-ink-faint" />
                {(event.guestCountAdults ?? 0) + (event.guestCountChildren ?? 0)} gasten
                {event.guestCountChildren ? ` (${event.guestCountChildren} kinderen)` : ""}
              </div>
            )}
          </div>
        </Card>

        <AssistantWidget eventId={id} />
      </div>
    </div>
  );
}
