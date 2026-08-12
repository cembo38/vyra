import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { loginAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Inloggen — Vyra" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Welkom terug</h1>
          <p className="mt-1 text-sm text-ink-faint">Vul je e-mailadres in — we sturen je een inloglink, geen wachtwoord nodig.</p>

          <form action={loginAction} className="mt-6 space-y-4">
            <Field label="E-mailadres" required>
              <Input type="email" name="email" required placeholder="jij@voorbeeld.nl" />
            </Field>
            <button type="submit" className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90">
              Stuur inloglink
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-faint">
            Nog geen account? <Link href="/signup" className="font-medium text-coral hover:underline">Registreer je</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
