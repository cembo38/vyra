import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAILS } from "@/lib/config";
import { AdminLoginForm } from "@/components/app/AdminLoginForm";

export const metadata = { title: "Admin inloggen — Vyra" };

/**
 * Los inlogscherm voor /admin (spec-item #52 vervolg) — bewust GEEN
 * onderdeel van de gewone /login-pagina of het marketing-uiterlijk: Cem
 * wilde een duidelijk gescheiden, herkenbaar "backoffice"-gevoel i.p.v.
 * tussen de consumenten-navigatie te moeten inloggen. Zelfde
 * Supabase-account als de rest van de app (zie adminLoginAction), alleen
 * de presentatie en de striktere ADMIN_EMAILS-check zijn anders.
 */
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user && ADMIN_EMAILS.includes(user.email.toLowerCase())) redirect("/admin");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-paper/10 text-paper">
            <ShieldCheck className="size-5" />
          </div>
          <h1 className="mt-4 font-display text-2xl text-paper">Vyra Admin</h1>
          <p className="mt-1 text-sm text-paper/60">Alleen voor platformbeheer — niet het gewone Vyra-account van organisatoren of leveranciers.</p>
        </div>

        <div className="rounded-2xl border border-paper/10 bg-paper/[0.04] p-6 [box-shadow:0_20px_60px_-20px_rgba(0,0,0,0.5)]">
          <AdminLoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-paper/40">
          Geen admin? Ga naar <a href="/login" className="underline decoration-paper/30 underline-offset-2 hover:text-paper/60">de gewone inlogpagina</a>.
        </p>
      </div>
    </div>
  );
}
