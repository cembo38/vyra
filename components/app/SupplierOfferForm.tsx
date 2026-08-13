"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";
import { generateSupplierOfferPreviewAction, submitSupplierOfferAction } from "@/lib/actions/supplier-actions";
import { formatCurrency } from "@/lib/config";
import { StructuredSupplierOffer } from "@/lib/ai/supplierOffer";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { SupplierCategory } from "@/lib/types";

export function SupplierOfferForm({ requestId, eventId, categoryKey }: { requestId: string; eventId: string; categoryKey: SupplierCategory }) {
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<StructuredSupplierOffer | null>(null);
  const [generating, startGenerate] = useTransition();
  const [submitting, startSubmit] = useTransition();

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-3 flex items-center gap-2 text-sage">
        <Sparkles className="size-4.5" />
        <p className="font-display text-lg text-ink">Breng je offerte uit</p>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Beschrijf in gewone taal wat je kunt aanbieden — de AI zet het om in een gestructureerde offerte die de organisator te zien krijgt. Controleer de prijs voordat je verstuurt.
      </p>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Bijv. 'Voor €6.500 kan ik volledige catering verzorgen inclusief bediening en levering, met vegetarische opties.'"
        rows={3}
      />
      <button
        type="button"
        disabled={!text.trim() || generating}
        onClick={() =>
          startGenerate(async () => {
            const res = await generateSupplierOfferPreviewAction(text);
            setResult(res);
            if (res?.totalPriceCents) setPrice(String(res.totalPriceCents / 100));
          })
        }
        className="chip-hover mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper disabled:opacity-40 disabled:pointer-events-none"
      >
        {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        Genereer offerte-voorstel
      </button>

      {result && (
        <div className="mt-4 rounded-xl bg-paper-dim p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Gestructureerd voorstel (concept)</p>
          {result.includes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.includes.map((inc) => <Badge key={inc} tone="success">{inc}</Badge>)}
            </div>
          )}
          <p className="mt-3 text-xs text-ink-faint">Controleer en pas de definitieve prijs hieronder aan voordat je verstuurt.</p>
        </div>
      )}

      <form
        action={(formData) => {
          startSubmit(() => submitSupplierOfferAction(formData));
        }}
        className="mt-5 border-t border-line-soft pt-5"
      >
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="categoryKey" value={categoryKey} />
        <input type="hidden" name="description" value={text} />

        <Field label="Definitieve prijs (totaal, incl. eventuele toeslagen)" required>
          <Input
            name="totalPrice"
            type="number"
            min={1}
            step={1}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="6500"
          />
        </Field>
        {price && !Number.isNaN(Number(price)) && (
          <p className="mt-1.5 text-xs text-ink-faint">Dit komt neer op {formatCurrency(Math.round(Number(price) * 100))} voor de organisator.</p>
        )}

        <button
          type="submit"
          disabled={submitting || !price}
          className="lift-hover mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark disabled:opacity-40 disabled:pointer-events-none"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Verstuur offerte naar organisator
        </button>
      </form>
    </div>
  );
}
