"use client";

import { useState, useTransition } from "react";
import { Loader2, LogIn } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { adminLoginAction } from "@/lib/actions/admin-auth-actions";

export function AdminLoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await adminLoginAction(formData);
          // Bij succes stuurt de action zelf door (redirect gooit een
          // speciale Next.js-navigatie-"error" die nooit hier aankomt) —
          // een normaal geretourneerd resultaat betekent dus altijd een
          // mislukte poging.
          if (result && !result.ok) setError(result.error ?? "Inloggen mislukt.");
        });
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-paper/80">E-mailadres</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          placeholder="jij@vyra.now"
          className="w-full rounded-xl border border-paper/15 bg-paper/5 px-4 py-3 text-base text-paper placeholder:text-paper/30 outline-none transition-colors focus:border-paper/40"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-paper/80">Wachtwoord</span>
        <div className="[&_input]:border-paper/15 [&_input]:bg-paper/5 [&_input]:text-paper [&_input]:placeholder:text-paper/30 [&_input:focus]:border-paper/40 [&_button]:text-paper/50 [&_button:hover]:text-paper">
          <PasswordInput name="password" required autoComplete="current-password" placeholder="••••••••" />
        </div>
      </label>

      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="chip-hover inline-flex w-full items-center justify-center gap-2 rounded-xl bg-paper px-4 py-3 text-sm font-medium text-ink disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Inloggen
      </button>
    </form>
  );
}
