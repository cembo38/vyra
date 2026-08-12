import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { signupAction, socialAuthAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Account aanmaken — Vyra" };

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Maak je account</h1>
          <p className="mt-1 text-sm text-ink-faint">Gratis, en klaar in minder dan een minuut.</p>

          <div className="mt-6 space-y-2.5">
            <form action={socialAuthAction}>
              <input type="hidden" name="provider" value="google" />
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-dim">
                Doorgaan met Google
              </button>
            </form>
            <form action={socialAuthAction}>
              <input type="hidden" name="provider" value="apple" />
              <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-2.5 text-sm font-medium text-ink transition-colors hover:bg-paper-dim">
                Doorgaan met Apple
              </button>
            </form>
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-ink-faint">
            <div className="h-px flex-1 bg-line" /> of met e-mail <div className="h-px flex-1 bg-line" />
          </div>

          <form action={signupAction} className="space-y-4">
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
