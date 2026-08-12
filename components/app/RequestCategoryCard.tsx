"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { sendRequestAction } from "@/lib/actions/marketplace-actions";
import { SupplierAvatar } from "@/components/ui/Avatar";
import { formatCurrency } from "@/lib/config";
import { SupplierCategory } from "@/lib/types";

export interface SupplierPreview {
  id: string;
  companyName: string;
  avgPriceCents: number;
  ratingAvg: number;
  verified: boolean;
  photoGradient: [string, string];
  initials: string;
  matchScore: number;
}

export function RequestCategoryCard({
  eventId,
  categoryKey,
  label,
  defaultBudgetCents,
  matches,
}: {
  eventId: string;
  categoryKey: SupplierCategory;
  label: string;
  defaultBudgetCents: number | null;
  matches: SupplierPreview[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  if (sent !== null) {
    return (
      <div className="rounded-2xl border border-success-50 bg-success-50 px-5 py-4 text-sm text-success">
        Aanvraag voor <strong>{label}</strong> verstuurd naar {matches.length} leverancier{matches.length !== 1 ? "s" : ""}. {sent > 0 ? `Je hebt al ${sent} reactie${sent !== 1 ? "s" : ""}!` : "Je krijgt bericht zodra iemand reageert (binnen 48 uur)."}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink">{label}</p>
          <p className="text-sm text-ink-faint">{matches.length} passende leveranciers gevonden</p>
        </div>
        <div className="flex -space-x-2.5">
          {matches.slice(0, 4).map((m) => (
            <SupplierAvatar key={m.id} gradient={m.photoGradient} initials={m.initials} size={36} verified={m.verified} className="ring-2 ring-white" />
          ))}
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="mt-4 rounded-xl bg-paper-dim px-3.5 py-2.5 text-xs text-ink-faint">
          Nog geen leveranciers voor deze categorie in jouw regio — we breiden dit netwerk snel uit. Probeer het later nog eens of pas je locatie aan.
        </p>
      ) : !expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90"
        >
          <Send className="size-3.5" /> Bekijk aanbieders & verstuur aanvraag
        </button>
      ) : (
        <div className="mt-4 space-y-3 border-t border-line-soft pt-4">
          <div className="space-y-2">
            {matches.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-paper-dim px-3 py-2 text-sm">
                <div className="flex items-center gap-2.5">
                  <SupplierAvatar gradient={m.photoGradient} initials={m.initials} size={32} verified={m.verified} />
                  <span className="font-medium text-ink">{m.companyName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-faint">
                  <span>★ {m.ratingAvg.toFixed(1)}</span>
                  <span>≈ {formatCurrency(m.avgPriceCents)}</span>
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-dark">{m.matchScore}% match</span>
                </div>
              </div>
            ))}
          </div>
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Speciale wensen? Bijv. 'vegetarische opties' of 'graag ook zaterdag beschikbaar'"
            rows={2}
            className="w-full resize-none rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-violet"
          />
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await sendRequestAction({ eventId, categoryKey, desiredService: label, specialRequests, budgetCents: defaultBudgetCents });
                setSent(res?.offerCount ?? 0);
              })
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-coral-dark disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Stuur aanvraag
          </button>
        </div>
      )}
    </div>
  );
}
