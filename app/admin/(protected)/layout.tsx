import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/app/AdminShell";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAILS } from "@/lib/config";

/**
 * Poortwachter voor de hele admin-omgeving (spec-item #52 vervolg —
 * "aparte admin omgeving"). Deze layout geldt voor alles onder de
 * `(protected)`-routegroep — d.w.z. alle echte `/admin/*`-pagina's — maar
 * NIET voor `app/admin/login/page.tsx`, die als sibling van deze groep
 * bestaat, precies om een oneindige redirect-lus te voorkomen: zonder die
 * scheiding zou de inlogpagina zelf ook door déze layout gewrapt worden,
 * die vervolgens weer doorstuurt naar de inlogpagina.
 *
 * Stuurt bewust door naar `/admin/login` (niet meer naar `/events`, zoals
 * de oude, ééndelige `app/admin/page.tsx` deed) — dat hoorde bij de oude
 * situatie waarin admin nog een sectie ván de gewone, ingelogde app was.
 */
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !ADMIN_EMAILS.includes(user.email.toLowerCase())) redirect("/admin/login");

  return <AdminShell email={user.email}>{children}</AdminShell>;
}
