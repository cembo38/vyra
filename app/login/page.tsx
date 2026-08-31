import Link from "next/link";
import { Logo } from "@/components/marketing/Logo";
import { Field, Input } from "@/components/ui/Form";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthErrorBanner } from "@/components/app/AuthErrorBanner";
import { SocialLoginButtons } from "@/components/app/SocialLoginButtons";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { loginAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Inloggen — Vyra" };

export default async function LoginPage(props: PageProps<"/login">) {
  const params = await props.searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const resetSuccess = params.resetSuccess === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Welkom terug</h1>
          <p className="mt-1 text-sm text-ink-faint">Log in met je e-mailadres en wachtwoord.</p>

          {resetSuccess && (
            <div className="mt-4 rounded-xl bg-success-50 px-4 py-2.5 text-sm text-success">
              Je wachtwoord is gewijzigd. Log hieronder in met je nieuwe wachtwoord.
            </div>
          )}
          <AuthErrorBanner code={errorCode} />

          <form action={loginAction} className="mt-6 space-y-4">
            <Field label="E-mailadres" required>
              <Input type="email" name="email" required placeholder="jij@voorbeeld.nl" />
            </Field>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-ink">Wachtwoord <span className="text-clay">*</span></span>
                <Link href="/wachtwoord-vergeten" className="text-xs font-medium text-clay hover:underline">Wachtwoord vergeten?</Link>
              </span>
              <PasswordInput name="password" required placeholder="••••••••" autoComplete="current-password" />
            </label>
            <SubmitButton pendingLabel="Bezig met inloggen…" className="lift-hover w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
              Inloggen
            </SubmitButton>
          </form>

          <SocialLoginButtons />

          <p className="mt-6 text-center text-sm text-ink-faint">
            Nog geen account? <Link href="/signup" className="font-medium text-clay hover:underline">Registreer je</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
