import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthErrorBanner } from "@/components/app/AuthErrorBanner";
import { signupAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Account aanmaken — Vyra" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const params = await props.searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const intent = typeof params.intent === "string" ? params.intent : undefined;

  // Na een mislukte poging (bv. beide rol-vinkjes uitgelaten) stuurt
  // signupAction de eerder ingevulde velden terug als queryparams — dat
  // voorkomt dat de gebruiker naam/e-mail/wachtwoord opnieuw moet intypen.
  // Het wachtwoord zelf zit daar bewust niet bij (nooit in een URL).
  const prevFirstName = typeof params.firstName === "string" ? params.firstName : "";
  const prevLastName = typeof params.lastName === "string" ? params.lastName : "";
  const prevEmail = typeof params.email === "string" ? params.email : "";
  const hasRetryState = params.asOrganizer !== undefined || params.asSupplier !== undefined;
  // Referral-programma (livegang-audit) — "ref" komt binnen via een gedeelde
  // uitnodigingslink (zie ReferralSection.tsx) en wordt hier alleen
  // doorgegeven, niet gevalideerd (dat gebeurt server-side, zie
  // handle_new_user() in migratie 0045).
  const ref = typeof params.ref === "string" ? params.ref : "";

  // Vooraf aangevinkt op basis van waar iemand vandaan komt (bv. de
  // leveranciers-landingspagina), maar altijd nog te wijzigen — één account
  // kan prima zowel organisator als leverancier zijn. Bij een retry na een
  // mislukte poging wint de eerder gekozen combinatie van de intent-hint.
  const defaultOrganizer = hasRetryState ? params.asOrganizer === "1" : intent !== "supplier";
  const defaultSupplier = hasRetryState ? params.asSupplier === "1" : intent === "supplier" || intent === "both";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Maak je account</h1>
          <p className="mt-1 text-sm text-ink-faint">Gratis — met e-mail en wachtwoord, je komt meteen op je eigen pagina.</p>

          <AuthErrorBanner code={errorCode} />

          <form action={signupAction} className="mt-6 space-y-4">
            {ref && <input type="hidden" name="ref" value={ref} />}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam" required>
                <Input name="firstName" required placeholder="Emma" defaultValue={prevFirstName} />
              </Field>
              <Field label="Achternaam" required>
                <Input name="lastName" required placeholder="de Vries" defaultValue={prevLastName} />
              </Field>
            </div>
            <Field label="E-mailadres" required>
              <Input type="email" name="email" required placeholder="jij@voorbeeld.nl" defaultValue={prevEmail} />
            </Field>
            <Field label="Wachtwoord" required hint="Minimaal 8 tekens">
              <PasswordInput name="password" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
            </Field>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Wat wil je op Vyra doen? <span className="text-clay">*</span></legend>
              <div className="space-y-2 rounded-xl border border-line p-3">
                <label className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    name="asOrganizer"
                    defaultChecked={defaultOrganizer}
                    className="mt-0.5 size-4 rounded border-line text-clay accent-clay"
                  />
                  <span>
                    <span className="font-medium text-ink">Evenementen organiseren</span> — plan je eigen bruiloft, feest of event met AI-hulp
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    name="asSupplier"
                    defaultChecked={defaultSupplier}
                    className="mt-0.5 size-4 rounded border-line text-clay accent-clay"
                  />
                  <span>
                    <span className="font-medium text-ink">Als leverancier aanvragen ontvangen</span> — bied je diensten aan en ontvang aanvragen van organisatoren
                  </span>
                </label>
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">Je kunt allebei aanvinken — je hoeft hiervoor maar één account aan te maken.</p>
            </fieldset>

            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 size-4 rounded border-line text-clay accent-clay"
              />
              <span>
                Ik ga akkoord met de{" "}
                <Link href="/voorwaarden" className="font-medium text-clay hover:underline" target="_blank">
                  algemene voorwaarden
                </Link>{" "}
                en de{" "}
                <Link href="/privacy" className="font-medium text-clay hover:underline" target="_blank">
                  privacyverklaring
                </Link>
                .
              </span>
            </label>

            <button type="submit" className="lift-hover w-full rounded-xl bg-clay py-2.5 text-sm font-medium text-white hover:bg-clay-dark">
              Account aanmaken
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-faint">
            Heb je al een account? <Link href="/login" className="font-medium text-clay hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
