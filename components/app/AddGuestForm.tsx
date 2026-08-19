"use client";

import { useState, useTransition } from "react";
import { Plus, Users, X } from "lucide-react";
import { addGuestAction, addGuestsBulkAction } from "@/lib/actions/guest-actions";
import { Field, Input, Textarea } from "@/components/ui/Form";

export function AddGuestForm({ eventId }: { eventId: string }) {
  const [mode, setMode] = useState<"closed" | "single" | "bulk">("closed");
  const [pending, startTransition] = useTransition();

  if (mode === "closed") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMode("single")}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-ink"
        >
          <Plus className="size-3.5" /> Gast toevoegen
        </button>
        <button
          onClick={() => setMode("bulk")}
          className="chip-hover inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink-soft hover:border-clay/50 hover:text-ink"
        >
          <Users className="size-3.5" /> Meerdere in één keer
        </button>
      </div>
    );
  }

  if (mode === "bulk") {
    return (
      <div className="w-full rounded-2xl border border-line bg-white p-4 shadow-sm sm:max-w-md">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Meerdere gasten toevoegen</p>
          <button onClick={() => setMode("closed")} aria-label="Sluiten" className="icon-pop text-ink-faint hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-2 text-xs text-ink-faint">Eén naam per regel — je kunt dit zo uit een spreadsheet plakken.</p>
        <form
          action={(formData) =>
            startTransition(async () => {
              await addGuestsBulkAction(eventId, formData);
              setMode("closed");
            })
          }
        >
          <Textarea name="names" rows={5} placeholder={"Anna Jansen\nPieter de Vries\n..."} />
          <button
            type="submit"
            disabled={pending}
            className="chip-hover mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper disabled:opacity-40 disabled:pointer-events-none"
          >
            {pending ? "Toevoegen…" : "Gasten toevoegen"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-line bg-white p-4 shadow-sm sm:max-w-md">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Gast toevoegen</p>
        <button onClick={() => setMode("closed")} aria-label="Sluiten" className="icon-pop text-ink-faint hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
      <form
        action={(formData) =>
          startTransition(async () => {
            await addGuestAction(eventId, formData);
            setMode("closed");
          })
        }
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Field label="Naam" required>
          <Input name="name" required placeholder="Voor- en achternaam" />
        </Field>
        <Field label="Groep" hint="Optioneel">
          <Input name="groupLabel" placeholder="Bijv. Familie bruid" />
        </Field>
        <Field label="E-mail" hint="Optioneel">
          <Input name="email" type="email" />
        </Field>
        <Field label="Telefoon" hint="Optioneel">
          <Input name="phone" />
        </Field>
        <button
          type="submit"
          disabled={pending}
          className="lift-hover inline-flex items-center justify-center gap-1.5 rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark disabled:opacity-40 disabled:pointer-events-none sm:col-span-2"
        >
          {pending ? "Toevoegen…" : "Toevoegen"}
        </button>
      </form>
    </div>
  );
}
