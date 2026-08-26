"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveFavoriteToCollectionAction } from "@/lib/actions/misc-actions";

const UNSORTED = "__unsorted__";

/**
 * Compacte "verplaats naar collectie"-select op elke favoriet-kaart
 * (spec-item #129) — een native `<select>` i.p.v. een eigen dropdown-
 * component: minder te bouwen/onderhouden, en werkt op elk apparaat
 * (inclusief toetsenbordnavigatie) zonder extra moeite.
 */
export function FavoriteCollectionSelect({
  supplierId,
  currentCollectionId,
  collections,
}: {
  supplierId: string;
  currentCollectionId: string | null;
  collections: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(currentCollectionId ?? UNSORTED);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function onChange(next: string) {
    setValue(next);
    startTransition(async () => {
      const result = await moveFavoriteToCollectionAction(supplierId, next === UNSORTED ? null : next);
      if (!result.ok) {
        setValue(currentCollectionId ?? UNSORTED); // terugdraaien bij een fout
        return;
      }
      router.refresh();
    });
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      aria-label="Verplaats naar collectie"
      className="w-full rounded-lg border border-line-soft bg-paper-dim px-2 py-1.5 text-xs text-ink-soft outline-none focus:border-sage"
    >
      <option value={UNSORTED}>Niet ingedeeld</option>
      {collections.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
