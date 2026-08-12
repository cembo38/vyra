"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateSupplierOfferPreviewAction } from "@/lib/actions/supplier-actions";
import { formatCurrency } from "@/lib/config";
import { StructuredSupplierOffer } from "@/lib/ai/supplierOffer";
import { Badge } from "@/components/ui/Badge";

export function SupplierOfferBuilder() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<StructuredSupplierOffer | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-3 flex items-center gap-2 text-violet">
        <Sparkles className="size-4.5" />
        <p className="font-display text-lg text-ink">AI-offerte-assistent</p>
      </div>
      <p className="mb-4 text-sm text-ink-soft">Beschrijf in gewone taal wat je voor dit evenement kunt aanbieden — de AI zet het om in een gestructureerde offerte.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Bijv. 'Voor €6.500 kan ik volledige catering verzorgen inclusief bediening en levering, met vegetarische opties.'"
        rows={3}
        className="w-full resize-none rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-violet"
      />
      <button
        disabled={!text.trim() || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await generateSupplierOfferPreviewAction(text);
            setResult(res);
          })
        }
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper disabled:opacity-40"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        Genereer offerte
      </button>

      {result && (
        <div className="mt-4 rounded-xl bg-paper-dim p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Gestructureerde offerte (concept)</p>
          <p className="mt-1.5 font-display text-2xl text-ink">{result.totalPriceCents ? formatCurrency(result.totalPriceCents) : "Prijs nog niet herkend"}</p>
          {result.includes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.includes.map((inc) => <Badge key={inc} tone="success">{inc}</Badge>)}
            </div>
          )}
          <p className="mt-3 text-xs text-ink-faint">Controleer en pas dit concept aan voordat je het verstuurt naar de organisator.</p>
        </div>
      )}
    </div>
  );
}
