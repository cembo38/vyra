import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { signupAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Account aanmaken — Vyra" };

export default async function SignupPage(props: PageProps<"/signup">) {
  const params = await props.searchParams;
  const hasError = params.error === "consent";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Maak je account</h1>
          <p className="mt-1 text-sm text-ink-faint">Gratis, en zonder wachtwoord — we sturen je een inloglink per e-mail.</p>

          {hasError && (
            <div className="mt-4 rounded-xl border border-warning-50 bg-warning-50 px-3 py-2 text-sm text-warning">
              Je moet akkoord gaan met de voorwaarden en de privacyverklaring om een account aan te maken.
            </div>
          )}

          <form action={signupAction} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam" required>
                <Input name="firstName" required placeholder="Emma" />
              </Field>
              <Field label="Achternaam" required>
                <Input name="lastName" required placeholder="de Vries" />
              </Field>
            </div>
            <Field label="E-mailadres" required>
              <Input type="email" name="email" required placeholder="jij@voorbeeld.nl" />
            </Field>

            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox"
                name="consent"
                required
                className="mt-0.5 size-4 rounded border-line text-coral accent-coral"
              />
              <span>
                Ik ga akkoord met de{" "}
                <Link href="/voorwaarden" className="font-medium text-coral hover:underline" target="_blank">
                  algemene voorwaarden
                </Link>{" "}
                en de{" "}
                <Link href="/privacy" className="font-medium text-coral hover:underline" target="_blank">
                  privacyverklaring
                </Link>
                .
              </span>
            </label>

            <button type="submit" className="w-full rounded-full bg-coral py-2.5 text-sm font-medium text-white transition-colors hover:bg-coral-dark">
              Account aanmaken
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-faint">
            Heb je al een account? <Link href="/login" className="font-medium text-coral hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
