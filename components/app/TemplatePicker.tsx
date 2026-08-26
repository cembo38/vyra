"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Loader2, Plus, X } from "lucide-react";
import { createSupplierTemplateAction, deleteSupplierTemplateAction, listSupplierTemplatesAction } from "@/lib/actions/template-actions";
import { SupplierTemplate, SupplierTemplateKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * "Opgeslagen sjablonen voor offertes/berichten" (livegang-audit) — een
 * klein popover-knopje dat in zowel SupplierOfferForm.tsx (kind="offer")
 * als MessageComposer.tsx (kind="message", leverancierskant) wordt
 * gebruikt. Bewust GEEN prop met de sjablonenlijst vanuit de server-pagina
 * — dat zou elke pagina die een van deze twee formulieren rendert moeten
 * laten weten over sjablonen, terwijl de meeste bezoeken de popover nooit
 * openen. In plaats daarvan haalt dit component de lijst zelf op (lazy,
 * pas bij de eerste keer openen) via listSupplierTemplatesAction.
 *
 * Los van elk abonnementsniveau — dit is platte, eigen tekst, geen
 * VyrAI-aanroep — dus geen `assistantEnabled`-achtige gate nodig.
 */
export function TemplatePicker({
  kind,
  currentText,
  onInsert,
  /** MessageComposer.tsx staat onderaan het scherm vastgezet — daar moet de popover omhoog openen i.p.v. van het scherm af te vallen. */
  openUpward = false,
  className,
}: {
  kind: SupplierTemplateKind;
  currentText: string;
  onInsert: (body: string) => void;
  openUpward?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<SupplierTemplate[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    setOpen((v) => !v);
    if (!loaded) {
      setLoading(true);
      listSupplierTemplatesAction(kind).then((list) => {
        setTemplates(list);
        setLoaded(true);
        setLoading(false);
      });
    }
  }

  function insert(body: string) {
    onInsert(body);
    setOpen(false);
  }

  function remove(id: string) {
    // Optimistisch verwijderen uit de lijst — een mislukte serververwijdering
    // (zeldzaam; alleen bij een verbindingsprobleem) betekent hooguit dat het
    // sjabloon na een pagina-ververs weer terugkomt, geen kapotte UI.
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    deleteSupplierTemplateAction(id);
  }

  function saveCurrent() {
    if (!newTitle.trim() || !currentText.trim() || saving) return;
    setError(null);
    setSaving(true);
    createSupplierTemplateAction(kind, newTitle, currentText).then((res) => {
      setSaving(false);
      if (!res.ok || !res.template) {
        setError(res.error ?? "Opslaan is niet gelukt.");
        return;
      }
      setTemplates((prev) => [res.template!, ...prev]);
      setNewTitle("");
    });
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label="Sjablonen"
        aria-expanded={open}
        className="icon-pop flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim"
      >
        <Bookmark className="size-4" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-3 [box-shadow:var(--shadow-card)]",
            openUpward ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">Sjablonen</p>

          {loading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-ink-faint">
              <Loader2 className="size-3.5 animate-spin" /> Laden…
            </div>
          ) : templates.length === 0 ? (
            <p className="py-1 text-xs text-ink-faint">Nog geen sjablonen opgeslagen.</p>
          ) : (
            <div className="max-h-48 space-y-0.5 overflow-y-auto">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center gap-1 rounded-lg hover:bg-paper-dim">
                  <button type="button" onClick={() => insert(t.body)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm text-ink">
                    {t.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    aria-label={`${t.title} verwijderen`}
                    className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-line-soft hover:text-danger"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 border-t border-line-soft pt-2">
            <div className="flex items-center gap-1.5">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titel voor huidige tekst…"
                disabled={!currentText.trim()}
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs outline-none placeholder:text-ink-faint disabled:opacity-50"
              />
              <button
                type="button"
                onClick={saveCurrent}
                disabled={!newTitle.trim() || !currentText.trim() || saving}
                aria-label="Bewaar als sjabloon"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-paper disabled:opacity-30"
              >
                {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3.5" />}
              </button>
            </div>
            {!currentText.trim() ? (
              <p className="mt-1 text-[11px] text-ink-faint">Typ eerst tekst om als sjabloon te bewaren.</p>
            ) : (
              error && <p className="mt-1 text-[11px] text-danger">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
