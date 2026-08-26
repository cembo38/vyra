"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { deleteFavoriteCollectionAction, renameFavoriteCollectionAction } from "@/lib/actions/misc-actions";

/**
 * Kop boven een collectie-groep op "Mijn leveranciers" (spec-item #129) —
 * inline hernoemen (zelfde patroon als EditableBudgetTotal.tsx) + een
 * verwijderknop. Verwijderen is bewust zonder bevestigingsdialoog: de
 * favorieten zelf blijven altijd bestaan (ze vallen terug op "Niet
 * ingedeeld", zie deleteFavoriteCollectionAction), dus er gaat niets
 * definitief verloren als iemand per ongeluk klikt.
 */
export function FavoriteCollectionHeader({ collectionId, name, count }: { collectionId: string; name: string; count: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    setValue(name);
    setError(null);
    setEditing(true);
  }

  function save() {
    if (!value.trim()) return;
    startTransition(async () => {
      const result = await renameFavoriteCollectionAction(collectionId, value.trim());
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteFavoriteCollectionAction(collectionId);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={pending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="rounded-lg border border-line bg-white px-2 py-1 font-display text-lg text-ink focus:border-clay focus:outline-none"
        />
        <button type="button" onClick={save} disabled={pending} aria-label="Opslaan" className="icon-pop flex size-8 items-center justify-center rounded-full text-success hover:bg-success-50 disabled:opacity-50">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={pending} aria-label="Annuleren" className="icon-pop flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim disabled:opacity-50">
          <X className="size-4" />
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <h2 className="font-display text-lg text-ink">{name}</h2>
      <span className="text-xs text-ink-faint">({count})</span>
      <button type="button" onClick={startEditing} aria-label="Collectie hernoemen" className="icon-pop flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-paper-dim hover:text-ink">
        <Pencil className="size-3.5" />
      </button>
      <button type="button" onClick={remove} disabled={pending} aria-label="Collectie verwijderen" className="icon-pop flex size-8 items-center justify-center rounded-full text-ink-faint hover:bg-danger-50 hover:text-danger disabled:opacity-50">
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}
