import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Inbox, MoveRight, Send, Sparkles, Wallet } from "lucide-react";
import { NextStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ExpandToggle } from "@/components/ui/ExpandToggle";

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
 *
 * Herontwerp (sep. 2026): de gele AI-risicomeldingen stonden voorheen als
 * losse, altijd-zichtbare kaartjes los onder deze kaart — twee aparte
 * "let hier op"-signalen tegelijk op het scherm. Nu zit dat ene extra
 * signaal (`risks`) hierin verwerkt als een ingeklapte "+N andere
 * aandachtspunten"-link (via `ExpandToggle`, onthoudt de open/dicht-status
 * — zie dat component). De hoofdactie blijft altijd meteen zichtbaar; de
 * rest is één klik verder, maar nooit weg.
 */
export function NextStepCard({ step, risks = [] }: { step: NextStep; risks?: { id: string; message: string; href: string }[] }) {
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

      {risks.length > 0 && (
        <div className="mt-1">
          <ExpandToggle
            storageKey="dashboard-aandachtspunten"
            moreLabel={`+ ${risks.length} ${risks.length === 1 ? "ander aandachtspunt" : "andere aandachtspunten"}`}
            lessLabel="Verberg aandachtspunten"
          >
            <div className="mt-3 space-y-2">
              {risks.map((r) => (
                <Link
                  key={r.id}
                  href={r.href}
                  className="chip-hover flex items-start gap-2.5 rounded-xl border border-warning-50 bg-warning-50 px-4 py-3 text-sm text-warning transition hover:border-warning hover:bg-warning-50/80"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p className="flex-1">{r.message}</p>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-60" />
                </Link>
              ))}
            </div>
          </ExpandToggle>
        </div>
      )}
    </div>
  );
}
