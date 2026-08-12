import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { RequirementPriority, EventStage, OfferStatus, RequirementCategory } from "@/lib/types";

export function Badge({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "violet" | "gold" | "coral";
  className?: string;
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-paper-dim text-ink-soft border-line",
    success: "bg-success-50 text-success border-transparent",
    warning: "bg-warning-50 text-warning border-transparent",
    danger: "bg-danger-50 text-danger border-transparent",
    violet: "bg-violet-50 text-violet-dark border-transparent",
    gold: "bg-gold-50 text-gold border-transparent",
    coral: "bg-coral-50 text-coral-dark border-transparent",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

/** Onderscheidt AI-gegenereerde aanbevelingen visueel van user/supplier-data (spec §34). */
export function AiTag({ children = "AI-aanbeveling", className }: { children?: ReactNode; className?: string }) {
  return (
    <Badge tone="violet" icon={<Sparkles className="size-3" />} className={className}>
      {children}
    </Badge>
  );
}

const priorityConfig: Record<RequirementPriority, { label: string; tone: "danger" | "gold" | "neutral" }> = {
  essential: { label: "Essentieel", tone: "danger" },
  recommended: { label: "Aanbevolen", tone: "gold" },
  optional: { label: "Optioneel", tone: "neutral" },
};

export function PriorityBadge({ priority }: { priority: RequirementPriority }) {
  const { label, tone } = priorityConfig[priority];
  return <Badge tone={tone}>{label}</Badge>;
}

const stageConfig: Record<EventStage, { label: string; tone: "neutral" | "success" | "violet" | "gold" }> = {
  draft: { label: "Concept", tone: "neutral" },
  planning: { label: "Plan wordt gemaakt", tone: "violet" },
  sourcing: { label: "Aanvragen lopen", tone: "gold" },
  booking: { label: "Keuzes maken", tone: "gold" },
  confirmed: { label: "Bevestigd", tone: "success" },
  completed: { label: "Afgerond", tone: "success" },
};

export function StageBadge({ stage }: { stage: EventStage }) {
  const { label, tone } = stageConfig[stage];
  return <Badge tone={tone}>{label}</Badge>;
}

const requirementStatusConfig: Record<RequirementCategory["status"], { label: string; tone: "neutral" | "success" | "violet" | "gold" | "danger" }> = {
  suggested: { label: "AI-suggestie", tone: "violet" },
  selected: { label: "Geselecteerd", tone: "neutral" },
  requested: { label: "Aangevraagd", tone: "gold" },
  awaiting_response: { label: "Wacht op reactie", tone: "gold" },
  offers_received: { label: "Offertes ontvangen", tone: "violet" },
  shortlisted: { label: "Op shortlist", tone: "gold" },
  confirmed: { label: "Bevestigd", tone: "success" },
  paid: { label: "Betaald", tone: "success" },
  completed: { label: "Afgerond", tone: "success" },
  rejected: { label: "Afgewezen", tone: "danger" },
};

export function RequirementStatusBadge({ status }: { status: RequirementCategory["status"] }) {
  const { label, tone } = requirementStatusConfig[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const offerStatusConfig: Record<OfferStatus, { label: string; tone: "neutral" | "success" | "violet" | "gold" | "danger" }> = {
  pending: { label: "In behandeling", tone: "neutral" },
  available: { label: "Beschikbaar", tone: "success" },
  unavailable: { label: "Niet beschikbaar", tone: "danger" },
  shortlisted: { label: "Op shortlist", tone: "gold" },
  accepted: { label: "Geaccepteerd", tone: "success" },
  declined: { label: "Afgewezen", tone: "neutral" },
  expired: { label: "Verlopen", tone: "danger" },
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  const { label, tone } = offerStatusConfig[status];
  return <Badge tone={tone}>{label}</Badge>;
}
