"use client";

import { useState, useTransition } from "react";
import { BadgeCheck, CheckCircle2, Eye, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  approveBriefingSupplierAction,
  dismissBriefingItemAction,
  generateBriefingNowAction,
  rejectBriefingSupplierAction,
  type ActionResult,
} from "@/lib/actions/admin-actions";
import type { AdminBriefing, AdminBriefingItem } from "@/lib/types";

/**
 * "Jouw AI-team" — dagelijks rapport voor de platformeigenaar (spec-item
 * #52 vervolg). Cem wilde dat een klein "team" van AI-collega's hem elke
 * dag informeert zoals een echt team aan de CEO zou rapporteren: kort,
 * per domein, met expliciete goedkeuren/afwijzen-knoppen voor de dingen
 * die dat verdienen — en gewoon stil als er niets te melden is.
 *
 * Belangrijk: dit is in de praktijk niet letterlijk vijf losse
 * autonome AI-agents die de klok rond draaien — het is één dagelijkse,
 * server-side aanroep (generateAndStoreDailyBriefing() in
 * lib/data/store.ts) die de echte platformcijfers verzamelt en er één
 * gecoördineerd, per-domein gestructureerd verslag van laat schrijven.
 * De "teamleden" hieronder zijn dus een presentatievorm — herkenbaar en
 * prettig leesbaar voor Cem — van wat onder water één samenhangend
 * proces is. Geen enkel team-onderdeel voert ooit zelf iets uit: elke
 * knop hieronder is een expliciete, door Cem zelf bevestigde actie.
 */
export function AdminBriefingCard({ briefing }: { briefing: AdminBriefing | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function generateNow() {
    setError(null);
    startTransition(async () => {
      const result = await generateBriefingNowAction();
      if (!result.ok) setError(result.error);
    });
  }

  const openItems = briefing?.items.filter((i) => i.status === "open") ?? [];
  const actionableCount = openItems.filter((i) => i.requiresApproval).length;
  const teamNames = briefing ? Object.keys(briefing.teamHeadlines) : [];

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-sage-50 text-sage">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h2 className="font-display text-lg text-ink">Jouw AI-team</h2>
            <p className="text-xs text-ink-faint">
              {briefing ? `Rapport van ${new Date(briefing.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : "Nog geen rapport gegenereerd"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actionableCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-ochre-50 px-2.5 py-1 text-xs font-medium text-ochre">{actionableCount} vraagt goedkeuring</span>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={generateNow}
            title="Genereer nu een vers rapport (loopt normaal automatisch elke ochtend)"
            className="chip-hover inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Genereer nu
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {!briefing ? (
        <div className="mt-4">
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title="Nog geen dagrapport"
            description="Elke ochtend om 08:00 verzamelt je AI-team automatisch nieuwe verificatieaanvragen, geschillen, aanmeldingen en meldingen. Klik hierboven om er nu meteen één te genereren."
          />
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          <p className="rounded-xl bg-paper-dim px-4 py-3 text-sm leading-relaxed text-ink">{briefing.coordinatorSummary}</p>
          {!briefing.usedAI && (
            <p className="-mt-3 text-xs text-ink-faint">Gegenereerd zonder AI-tekstlaag (geen ANTHROPIC_API_KEY geconfigureerd) — de cijfers hieronder zijn wel echt.</p>
          )}

          <div className="space-y-4">
            {teamNames.map((teamName) => {
              const items = openItems.filter((i) => i.teamMember === teamName);
              return (
                <div key={teamName} className="rounded-xl border border-line-soft p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-ink">{teamName}</p>
                    {items.length === 0 && <CheckCircle2 className="size-4 text-success" />}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-faint">{briefing.teamHeadlines[teamName]}</p>
                  {items.length > 0 && (
                    <div className="mt-2.5 space-y-2">
                      {items.map((item) => (
                        <BriefingItemRow key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BriefingItemRow({ item }: { item: AdminBriefingItem }) {
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  function run(action: (formData: FormData) => Promise<ActionResult>, extra?: Record<string, string>) {
    setLocalError(null);
    const formData = new FormData();
    formData.set("itemId", item.id);
    if (extra) for (const [key, value] of Object.entries(extra)) formData.set(key, value);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) setLocalError(result.error);
    });
  }

  return (
    <div className="rounded-lg border border-line-soft bg-paper px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-ink">{item.title}</p>
            {item.requiresApproval && <Badge tone="ochre">Actie nodig</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">{item.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {item.kind === "supplier_verification" && item.relatedId ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(approveBriefingSupplierAction, { supplierId: item.relatedId! })}
                className="chip-hover inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <BadgeCheck className="size-3" />}
                Goedkeuren
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(rejectBriefingSupplierAction, { supplierId: item.relatedId! })}
                className="chip-hover inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-danger/50 hover:text-danger disabled:opacity-40 disabled:pointer-events-none"
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                Afwijzen
              </button>
            </>
          ) : (
            <>
              {item.kind === "dispute" && (
                <a href="#geschillen" className="chip-hover inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-soft hover:border-sage/50 hover:text-ink">
                  <Eye className="size-3" /> Bekijk
                </a>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => run(dismissBriefingItemAction)}
                className="chip-hover inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-faint hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
              >
                {pending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                Gezien
              </button>
            </>
          )}
        </div>
      </div>
      {localError && <p className="mt-1.5 text-xs text-danger">{localError}</p>}
    </div>
  );
}
