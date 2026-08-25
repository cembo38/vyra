import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppTopBar } from "@/components/app/AppTopBar";

export default async function EventsLayout({ children }: LayoutProps<"/events">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <AppTopBar />
      {/* md:pl-[var(--nav-sidebar-w)]: ruimte vrijhouden voor de permanente
          zijbalk (NavShell.tsx, >= md) — zie de toelichting bij
          --nav-sidebar-w in app/globals.css voor waarom dit via een CSS-
          variabele loopt i.p.v. React-state. */}
      <main className="flex-1 transition-[padding-left] duration-200 ease-in-out md:pl-[var(--nav-sidebar-w)]">{children}</main>
    </div>
  );
}
