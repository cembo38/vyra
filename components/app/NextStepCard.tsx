import Link from "next/link";
import { CheckCircle2, Clock, Inbox, MoveRight, Send, Sparkles, Wallet } from "lucide-react";
import { NextStep } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  sparkles: Sparkles,
  send: Send,
  wallet: Wallet,
  clock: Clock,
  inbox: Inbox,
  "check-circle": CheckCircle2,
};

const TONE_STYLES: Record<NextStep["tone"], { bg: string; iconBg: string; iconText: string; ctaBg: string; ctaHover: string; label: string; labelText: string }> = {
  action: { bg: "bg-white", iconBg: "bg-clay-50", iconText: "text-clay-dark", ctaBg: "bg-clay", ctaHover: "hover:bg-clay-dark", label: "Volgende stap", labelText: "text-clay-dark" },
  warning: { bg: "bg-white", iconBg: "bg-warning-50", iconText: "text-warning", ctaBg: "bg-ink", ctaHover: "hover:bg-ink/90", label: "Aandacht nodig", labelText: "text-warning" },
  success: { bg: "bg-white", iconBg: "bg-success-50", iconText: "text-success", ctaBg: "bg-sage", ctaHover: "hover:bg-sage-dark", label: "Op schema", labelText: "text-success" },
};

/**
 * "Wat nu?"-kaart bovenaan het event-dashboard: berekent en toont in één
 * oogopslag de belangrijkste eerstvolgende actie (zie computeNextStep in
 * lib/data/store.ts), zodat de organisator nooit zelf hoeft te zoeken langs
 * welk tabblad die verder moet.
 */
export function NextStepCard({ step }: { step: NextStep }) {
  const Icon = ICONS[step.icon];
  const tone = TONE_STYLES[step.tone];

  return (
    <div className={cn("card-hover rounded-2xl border border-line p-5 [box-shadow:var(--shadow-card)] sm:p-6", tone.bg)}>
      <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
        <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone.iconBg, tone.iconText)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-xs font-medium uppercase tracking-wide", tone.labelText)}>{tone.label}</p>
          <p className="mt-0.5 font-display text-lg text-ink">{step.title}</p>
          <p className="mt-1 text-sm text-ink-soft">{step.description}</p>
        </div>
        <Link
          href={step.href}
          className={cn(
            "lift-hover inline-flex shrink-0 items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-white",
            tone.ctaBg,
            tone.ctaHover
          )}
        >
          {step.ctaLabel} <MoveRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
