import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { AuthErrorBanner } from "@/components/app/AuthErrorBanner";
import { signupAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Leveranciersaccount aanmaken — Vyra" };

export default async function SupplierSignupPage(props: PageProps<"/supplier/signup">) {
  const params = await props.searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <span className="text-xs font-medium uppercase tracking-wide text-coral">Voor leveranciers</span>
          <h1 className="mt-1 font-display text-2xl text-ink">Maak je leveranciersaccount</h1>
          <p className="mt-1 text-sm text-ink-faint">Gratis aanmelden, zonder wachtwoord — we sturen je een inloglink per e-mail. Daarna richt je in twee minuten je bedrijfsprofiel in.</p>

          <AuthErrorBanner code={errorCode} />

          <form action={signupAction} className="mt-6 space-y-4">
            <input type="hidden" name="role" value="supplier" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam" required>
                <Input name="firstName" required placeholder="Emma" />
              </Field>
              <Field label="Achternaam" required>
                <Input name="lastName" required placeholder="de Vries" />
              </Field>
            </div>
            <Field label="E-mailadres" required>
              <Input type="email" name="email" required placeholder="jij@bedrijf.nl" />
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
              Leveranciersaccount aanmaken
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-faint">
            Ben je organisator? <Link href="/signup" className="font-medium text-coral hover:underline">Maak hier je account</Link>
          </p>
          <p className="mt-2 text-center text-sm text-ink-faint">
            Heb je al een leveranciersaccount? <Link href="/login" className="font-medium text-coral hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
