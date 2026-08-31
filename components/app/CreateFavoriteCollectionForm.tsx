"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { createFavoriteCollectionAction } from "@/lib/actions/misc-actions";
import { VyraMarkSpinner } from "@/components/ui/PageLoader";

/**
 * "+ Nieuwe collectie" — spec-item #129. Bewust altijd zichtbaar (geen
 * "toon formulier"-toggle-knop ervoor): het is de enige manier om te
 * beginnen met indelen, dus verstoppen zou 'm juist minder ontdekbaar maken.
 */
export function CreateFavoriteCollectionForm() {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function create() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await createFavoriteCollectionAction(name.trim());
      if (!result.ok) {
        setError(result.error ?? "Dit is niet gelukt.");
        return;
      }
      setName("");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
          placeholder="Nieuwe collectie (bv. Bruiloft 2027)"
          disabled={pending}
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-sage disabled:opacity-60"
        />
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={create}
          className="chip-hover inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-medium text-ink-soft hover:border-sage/50 hover:text-ink disabled:opacity-40 disabled:pointer-events-none"
        >
          {pending ? <VyraMarkSpinner className="text-sm" /> : <FolderPlus className="size-3.5" />}
          Aanmaken
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
