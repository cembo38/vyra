"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { fileDisputeAction } from "@/lib/actions/dispute-actions";
import { DISPUTE_CATEGORY_LABELS, type Dispute, type DisputeCategory } from "@/lib/types";

const CATEGORY_OPTIONS = Object.entries(DISPUTE_CATEGORY_LABELS) as [DisputeCategory, string][];

/**
 * Geschil melden/bekijken over één specifieke boeking (spec-item #50) —
 * gedeeld tussen de checkout-pagina (organisator) en de bestellingenpagina
 * (leverancier). Als er al een open geschil loopt, toont dit alleen de
 * status (geen dubbele meldingen mogelijk — RLS staat dat sowieso niet toe
 * voor een tweede open geschil op dezelfde boeking, maar dit voorkomt al
 * dat iemand het probeert). Eerdere opgeloste/afgewezen geschillen blijven
 * zichtbaar als geschiedenis.
 */
export function DisputeReporter({
  paymentId,
  eventId,
  offerId,
  supplierId,
  disputes,
}: {
  paymentId: string;
  eventId: string;
  offerId: string;
  supplierId: string;
  disputes: Dispute[];
}) {
  const openDispute = disputes.find((d) => d.status === "open");
  const history = disputes.filter((d) => d.status !== "open");

  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState<DisputeCategory>("other");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit() {
    if (description.trim().length < 10) {
      setError("Beschrijf het probleem iets uitgebreider (minstens 10 tekens).");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("paymentId", paymentId);
    formData.set("eventId", eventId);
    formData.set("offerId", offerId);
    formData.set("supplierId", supplierId);
    formData.set("category", category);
    formData.set("description", description.trim());
    startTransition(async () => {
      const result = await fileDisputeAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setFormOpen(false);
      setDescription("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-xl border border-line-soft p-4">
      <div className="flex items-center gap-2 text-ink">
        <AlertTriangle className="size-4 text-ink-faint" />
        <h3 className="font-display text-base">Geschil</h3>
      </div>

      {openDispute ? (
        <div className="mt-3 rounded-lg bg-ochre-50 px-3.5 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <Badge tone="ochre">In behandeling</Badge>
            <span className="text-xs text-ink-faint">{DISPUTE_CATEGORY_LABELS[openDispute.category]}</span>
          </div>
          <p className="mt-1.5 text-ink-soft">{openDispute.description}</p>
          <p className="mt-1.5 text-xs text-ink-faint">Gemeld op {new Date(openDispute.createdAt).toLocaleDateString("nl-NL")} — Vyra bekijkt dit en reageert zo snel mogelijk.</p>
        </div>
      ) : (
        <>
          {history.length > 0 && (
            <div className="mt-3 space-y-2">
              {history.map((d) => (
                <div key={d.id} className="rounded-lg bg-paper-dim px-3.5 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    {d.status === "resolved" ? (
                      <Badge tone="success" icon={<CheckCircle2 className="size-3.5" />}>Opgelost</Badge>
                    ) : (
                      <Badge tone="neutral" icon={<XCircle className="size-3.5" />}>Afgewezen</Badge>
                    )}
                    <span className="text-xs text-ink-faint">{DISPUTE_CATEGORY_LABELS[d.category]}</span>
                  </div>
                  <p className="mt-1.5 text-ink-soft">{d.description}</p>
                  {d.adminResponse && <p className="mt-1.5 text-xs text-ink-faint"><span className="font-medium text-ink-soft">Reactie van Vyra:</span> {d.adminResponse}</p>}
                </div>
              ))}
            </div>
          )}

          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="chip-hover mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-clay hover:underline"
            >
              Meld een geschil <ChevronDown className="size-3.5" />
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <Field label="Categorie" required>
                <Select value={category} onChange={(e) => setCategory(e.target.value as DisputeCategory)}>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Wat is er gebeurd?" required hint="Vyra bekijkt dit en bemiddelt tussen jou en de andere partij.">
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beschrijf het probleem zo concreet mogelijk..." />
              </Field>
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={submit}
                  className="chip-hover inline-flex items-center gap-1.5 rounded-xl bg-clay px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 disabled:pointer-events-none"
                >
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Geschil versturen
                </button>
                <button type="button" disabled={pending} onClick={() => { setFormOpen(false); setError(null); }} className="text-sm text-ink-faint hover:text-ink-soft">
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
