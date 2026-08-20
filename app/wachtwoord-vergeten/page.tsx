import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { AuthErrorBanner } from "@/components/app/AuthErrorBanner";
import { requestPasswordResetAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Wachtwoord vergeten — Vyra" };

/**
 * Tot deze pagina er kwam kon een gebruiker die zijn wachtwoord vergat
 * letterlijk niet meer bij zijn account — er was nergens een "wachtwoord
 * vergeten"-link of -route. Zie /login voor de link hiernaartoe en
 * /wachtwoord-vergeten/nieuw voor de vervolgstap (na het klikken op de
 * link in de e-mail).
 */
export default async function ForgotPasswordPage(props: PageProps<"/wachtwoord-vergeten">) {
  const params = await props.searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Wachtwoord vergeten?</h1>
          <p className="mt-1 text-sm text-ink-faint">Vul je e-mailadres in — we sturen je een link om een nieuw wachtwoord in te stellen.</p>

          <AuthErrorBanner code={errorCode} />

          <form action={requestPasswordResetAction} className="mt-6 space-y-4">
            <Field label="E-mailadres" required>
              <Input type="email" name="email" required placeholder="jij@voorbeeld.nl" />
            </Field>
            <button type="submit" className="lift-hover w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
              Verstuur resetlink
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-faint">
            <Link href="/login" className="font-medium text-clay hover:underline">Terug naar inloggen</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
