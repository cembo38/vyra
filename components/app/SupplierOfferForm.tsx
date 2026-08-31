"use client";

import { useState, useTransition } from "react";
import { Sparkles, Send } from "lucide-react";
import { generateSupplierOfferPreviewAction, submitSupplierOfferAction } from "@/lib/actions/supplier-actions";
import { writeSupplierOfferTextAction } from "@/lib/actions/supplier-assistant-actions";
import { TemplatePicker } from "@/components/app/TemplatePicker";
import { formatCurrency } from "@/lib/config";
import { StructuredSupplierOffer } from "@/lib/ai/supplierOffer";
import { Badge } from "@/components/ui/Badge";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { SupplierCategory } from "@/lib/types";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

export function SupplierOfferForm({
  requestId,
  eventId,
  categoryKey,
  assistantEnabled = false,
}: {
  requestId: string;
  eventId: string;
  categoryKey: SupplierCategory;
  /** Toont de "VyrAI: werk dit uit"-knop (Offertehulp, Pro+) — zie checkSupplierAssistantAccess in lib/data/store.ts. De server action controleert dit zelf ook nog eens. */
  assistantEnabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [price, setPrice] = useState("");
  const [result, setResult] = useState<StructuredSupplierOffer | null>(null);
  const [generating, startGenerate] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [writing, startWrite] = useTransition();
  const [writeNote, setWriteNote] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-3 flex items-center gap-2 text-sage">
        <Sparkles className="size-4.5" />
        <p className="font-display text-lg text-ink">Breng je offerte uit</p>
      </div>
      <p className="mb-4 text-sm text-ink-soft">
        Beschrijf in gewone taal wat je kunt aanbieden — de AI zet het om in een gestructureerde offerte die de organisator te zien krijgt. Controleer de prijs voordat je verstuurt.
      </p>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <TemplatePicker kind="offer" currentText={text} onInsert={setText} />
        {assistantEnabled && (
          <button
            type="button"
            disabled={!text.trim() || writing}
            onClick={() => {
              setWriteNote(null);
              startWrite(async () => {
                const res = await writeSupplierOfferTextAction(text);
                if (res.blocked) {
                  setWriteNote(res.text);
                  return;
                }
                setText(res.text);
              });
            }}
            className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-sage-50 px-3 py-1.5 text-xs font-medium text-sage-dark disabled:opacity-40 disabled:pointer-events-none"
          >
            {writing ? <VyraMarkSpinner className="text-sm" /> : <Sparkles className="motion-icon-twinkle size-3.5" />}
            VyrAI: werk dit uit
          </button>
        )}
      </div>
      {writeNote && <p className="mb-2 rounded-lg bg-ochre-50 px-3 py-1.5 text-xs text-ink-soft">{writeNote}</p>}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={assistantEnabled ? "Bijv. 'catering 50p, incl bediening+levering, 6500' — typ een paar steekwoorden en klik op 'VyrAI: werk dit uit', of schrijf het zelf helemaal uit." : "Bijv. 'Voor €6.500 kan ik volledige catering verzorgen inclusief bediening en levering, met vegetarische opties.'"}
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
        {generating ? <VyraMarkSpinner className="text-sm" /> : <Sparkles className="size-3.5" />}
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
          {submitting ? <VyraMarkSpinner className="text-base" /> : <Send className="size-4" />}
          Verstuur offerte naar organisator
        </button>
      </form>
    </div>
  );
}
