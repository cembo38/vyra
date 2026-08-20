import { Logo } from "@/components/marketing/Logo";
import { MailCheck } from "lucide-react";

export const metadata = { title: "Check je e-mail — Vyra" };

export default async function PasswordResetSentPage(props: PageProps<"/wachtwoord-vergeten/verzonden">) {
  const params = await props.searchParams;
  const email = typeof params.email === "string" ? params.email : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper-dim px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="rounded-2xl border border-line bg-white p-8 [box-shadow:var(--shadow-card)]">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-sage-50 text-sage">
            <MailCheck className="size-6" />
          </div>
          <h1 className="mt-4 font-display text-xl text-ink">Check je inbox</h1>
          {/*
            Bewust "als er een account bestaat..." i.p.v. een directe
            bevestiging — of dit e-mailadres een account heeft blijft hier
            in het midden, zodat deze pagina niet gebruikt kan worden om
            geregistreerde e-mailadressen af te tasten (zie
            requestPasswordResetAction).
          */}
          <p className="mt-2 text-sm text-ink-soft">
            Als er een Vyra-account bestaat voor {email ? <strong>{email}</strong> : "dit e-mailadres"}, hebben we er zojuist een link naartoe gestuurd om een nieuw wachtwoord in te stellen.
          </p>
          <p className="mt-4 text-xs text-ink-faint">Niets ontvangen na een minuut? Check ook je spam-map.</p>
        </div>
      </div>
    </div>
  );
}
