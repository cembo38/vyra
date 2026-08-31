import { redirect } from "next/navigation";
import { Logo } from "@/components/marketing/Logo";
import { Field } from "@/components/ui/Form";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { AuthErrorBanner } from "@/components/app/AuthErrorBanner";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getCurrentUser } from "@/lib/auth";
import { updatePasswordAction } from "@/lib/actions/auth-actions";

export const metadata = { title: "Nieuw wachtwoord — Vyra" };

/**
 * Alleen bereikbaar met een geldige sessie — die ontstaat door op de link
 * in de reset-mail te klikken (die via /auth/callback?next=... hier al
 * ingelogd landt, zie requestPasswordResetAction). Wie deze pagina
 * rechtstreeks probeert te openen zonder die stap, heeft geen sessie en
 * wordt teruggestuurd om een nieuwe link aan te vragen.
 */
export default async function NewPasswordPage(props: PageProps<"/wachtwoord-vergeten/nieuw">) {
  const user = await getCurrentUser();
  if (!user) redirect("/wachtwoord-vergeten?error=expired");

  const params = await props.searchParams;
  const errorCode = typeof params.error === "string" ? params.error : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <h1 className="font-display text-2xl text-ink">Nieuw wachtwoord</h1>
          <p className="mt-1 text-sm text-ink-faint">Kies een nieuw wachtwoord voor je Vyra-account.</p>

          <AuthErrorBanner code={errorCode} />

          <form action={updatePasswordAction} className="mt-6 space-y-4">
            <Field label="Nieuw wachtwoord" required>
              <PasswordInput name="password" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
            </Field>
            <Field label="Herhaal wachtwoord" required>
              <PasswordInput name="passwordRepeat" required minLength={8} placeholder="••••••••" autoComplete="new-password" />
            </Field>
            <SubmitButton pendingLabel="Bezig met opslaan…" className="lift-hover w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-paper hover:bg-ink/90">
              Wachtwoord opslaan
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
