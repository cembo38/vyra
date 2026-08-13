import { Logo } from "@/components/marketing/Logo";
import { MailCheck } from "lucide-react";

export const metadata = { title: "Check je e-mail — Vyra" };

export default async function CheckEmailPage(props: PageProps<"/signup/check-email">) {
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
          <h1 className="mt-4 font-display text-xl text-ink">Bijna klaar</h1>
          <p className="mt-2 text-sm text-ink-soft">
            We hebben een bevestigingslink gestuurd naar {email ? <strong>{email}</strong> : "je e-mailadres"}. Klik op de link in die e-mail om je account te activeren.
          </p>
          <p className="mt-4 text-xs text-ink-faint">Niets ontvangen na een minuut? Check ook je spam-map.</p>
        </div>
      </div>
    </div>
  );
}
