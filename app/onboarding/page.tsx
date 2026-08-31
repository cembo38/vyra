import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input, Select } from "@/components/ui/Form";
import { getCurrentUser } from "@/lib/auth";
import { completeOnboardingAction, logoutAction } from "@/lib/actions/auth-actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata = { title: "Welkom — Vyra" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Nog een paar details</h1>
          <p className="mt-1 text-sm text-ink-faint">Zo stemmen we de app af op jouw voorkeuren.</p>

          <form action={completeOnboardingAction} className="mt-6 space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam" required>
                <Input name="firstName" defaultValue={user.firstName} required />
              </Field>
              <Field label="Achternaam" required>
                <Input name="lastName" defaultValue={user.lastName} required />
              </Field>
            </div>
            <Field label="Land">
              <Select name="country" defaultValue={user.country}>
                <option value="NL">Nederland</option>
                <option value="BE">België</option>
                <option value="DE">Duitsland</option>
                <option value="FR">Frankrijk</option>
                <option value="GB">Verenigd Koninkrijk</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voorkeurstaal">
                <Select name="language" defaultValue={user.language}>
                  <option value="nl">Nederlands</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label="Valuta">
                <Select name="currency" defaultValue={user.currency}>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                </Select>
              </Field>
            </div>
            <SubmitButton pendingLabel="Bezig met opslaan…" className="lift-hover w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
              Ga naar mijn evenementen
            </SubmitButton>
          </form>
        </div>

        {/* Deze pagina was tot nu toe een doodlopend eind: geen navigatie,
            geen manier om weg te komen als je bijvoorbeeld per ongeluk met
            het verkeerde account bent ingelogd. */}
        <form action={logoutAction} className="mt-4 text-center">
          <p className="text-xs text-ink-faint">
            Ingelogd als {user.email} ·{" "}
            <SubmitButton pendingLabel="Bezig met uitloggen…" className="font-medium text-clay hover:underline">Uitloggen</SubmitButton>
          </p>
        </form>
      </div>
    </div>
  );
}
