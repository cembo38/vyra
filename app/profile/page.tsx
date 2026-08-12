import { AppTopBar } from "@/components/app/AppTopBar";
import { Card } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Form";
import { UserAvatar } from "@/components/ui/Avatar";
import { getCurrentUser } from "@/lib/auth";
import { listEventsForUser } from "@/lib/data/store";
import { updateProfileAction, logoutAction } from "@/lib/actions/auth-actions";
import { PLATFORM_COMMISSION_RATE } from "@/lib/config";

export const metadata = { title: "Profiel — Vyra" };

export default async function ProfilePage(props: PageProps<"/profile">) {
  const user = await getCurrentUser();
  const searchParams = await props.searchParams;
  const events = listEventsForUser(user.id);

  return (
    <div className="min-h-screen bg-paper">
      <AppTopBar />
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-6 flex items-center gap-4">
          <UserAvatar firstName={user.firstName} lastName={user.lastName} color={user.avatarColor} size={56} />
          <div>
            <h1 className="font-display text-2xl text-ink">{user.firstName} {user.lastName}</h1>
            <p className="text-sm text-ink-faint">{user.email}</p>
          </div>
        </div>

        {searchParams.saved && (
          <div className="mb-4 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success">Je profiel is bijgewerkt.</div>
        )}

        <Card>
          <h2 className="mb-4 font-display text-lg text-ink">Persoonlijke gegevens</h2>
          <form action={updateProfileAction} className="space-y-4">
            <input type="hidden" name="userId" value={user.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam"><Input name="firstName" defaultValue={user.firstName} /></Field>
              <Field label="Achternaam"><Input name="lastName" defaultValue={user.lastName} /></Field>
            </div>
            <Field label="E-mailadres">
              <Input value={user.email} disabled className="opacity-60" />
            </Field>
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
            <button type="submit" className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90">
              Wijzigingen opslaan
            </button>
          </form>
        </Card>

        <Card className="mt-6">
          <h2 className="mb-2 font-display text-lg text-ink">Account</h2>
          <p className="text-sm text-ink-soft">{events.length} evenement{events.length !== 1 ? "en" : ""} · Organisator-account (gratis)</p>
          <p className="mt-1 text-xs text-ink-faint">Vyra rekent {(PLATFORM_COMMISSION_RATE * 100).toFixed(1)}% platformkosten aan leveranciers over succesvolle boekingen — jouw account als organisator is altijd gratis.</p>
          <div className="mt-4 flex gap-3">
            <form action={logoutAction}>
              <button type="submit" className="rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-dim">
                Uitloggen
              </button>
            </form>
          </div>
        </Card>

        <Card className="mt-6 border-dashed">
          <h2 className="mb-1 font-display text-base text-ink">Privacy & je gegevens</h2>
          <p className="text-sm text-ink-soft">
            Je kunt op elk moment een export van je gegevens aanvragen of je account laten verwijderen. Neem hiervoor contact op — deze zelfbedieningsfuncties komen in een volgende versie.
          </p>
        </Card>
      </div>
    </div>
  );
}
